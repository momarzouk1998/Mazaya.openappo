"use client";

function convertOklchToRgb(str: string, ctx: CanvasRenderingContext2D | null): string {
  if (!str || typeof str !== "string" || !str.includes("oklch")) return str;
  if (!ctx) return str.replace(/oklch\([^)]+\)/gi, "rgb(0,0,0)");
  return str.replace(/oklch\([^)]+\)/gi, (match) => {
    try {
      ctx.fillStyle = "#000000";
      ctx.fillStyle = match;
      return ctx.fillStyle;
    } catch {
      return "rgb(0,0,0)";
    }
  });
}

export async function downloadElementAsPdf({
  elementId,
  fileName,
  orientation = "landscape",
}: {
  elementId: string;
  fileName: string;
  orientation?: "landscape" | "portrait";
}) {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element #${elementId} not found`);
  }

  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF } = await import("jspdf");

  const canvas = await html2canvas(element, {
    useCORS: true,
    allowTaint: true,
    scale: 2,
    logging: false,
    backgroundColor: "#ffffff",
    scrollX: 0,
    scrollY: 0,
    windowWidth: 1400,
    onclone: (clonedDoc, clonedElement) => {
      const tempCanvas = clonedDoc.createElement("canvas");
      const ctx = tempCanvas.getContext("2d");

      // 1. Clean style tags
      const styleTags = clonedDoc.querySelectorAll("style");
      styleTags.forEach((styleTag) => {
        if (styleTag.textContent && styleTag.textContent.includes("oklch")) {
          styleTag.textContent = convertOklchToRgb(styleTag.textContent, ctx);
        }
      });

      // 2. Clean elements
      const origAll = [element, ...Array.from(element.querySelectorAll("*"))] as HTMLElement[];
      const clonedAll = [clonedElement, ...Array.from(clonedElement.querySelectorAll("*"))] as HTMLElement[];

      const COLOR_PROPS = [
        "color",
        "backgroundColor",
        "borderColor",
        "borderTopColor",
        "borderBottomColor",
        "borderLeftColor",
        "borderRightColor",
      ];

      for (let i = 0; i < origAll.length; i++) {
        const orig = origAll[i];
        const clone = clonedAll[i];
        if (!orig || !clone) continue;

        if (clone.style) {
          for (let s = 0; s < clone.style.length; s++) {
            const prop = clone.style[s];
            const val = clone.style.getPropertyValue(prop);
            if (val && val.includes("oklch")) {
              clone.style.setProperty(prop, convertOklchToRgb(val, ctx));
            }
          }
        }

        try {
          const computed = window.getComputedStyle(orig);
          for (const prop of COLOR_PROPS) {
            const val = (computed as any)[prop];
            if (val && typeof val === "string" && val.includes("oklch")) {
              const rgbVal = convertOklchToRgb(val, ctx);
              const cssProp = prop.replace(/([A-Z])/g, "-$1").toLowerCase();
              clone.style.setProperty(cssProp, rgbVal, "important");
            }
          }
        } catch {}
      }
    },
  });

  if (!canvas || canvas.width === 0 || canvas.height === 0) {
    throw new Error("Failed to render canvas");
  }

  const pdf = new jsPDF(orientation === "landscape" ? "l" : "p", "mm", "a4");
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const margin = 6;
  const printableWidth = pdfWidth - margin * 2;
  const printableHeight = pdfHeight - margin * 2;

  const imgData = canvas.toDataURL("image/jpeg", 0.95);
  const imgWidth = printableWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  if (imgHeight <= printableHeight) {
    const x = (pdfWidth - imgWidth) / 2;
    const y = margin;
    pdf.addImage(imgData, "JPEG", x, y, imgWidth, imgHeight);
  } else {
    // Multi-page slicing for large reports
    const pageCanvasHeight = (canvas.width * printableHeight) / printableWidth;
    let positionY = 0;
    let pageCount = 0;

    while (positionY < canvas.height) {
      const sliceHeight = Math.min(pageCanvasHeight, canvas.height - positionY);
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;

      const ctx = pageCanvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(
          canvas,
          0,
          positionY,
          canvas.width,
          sliceHeight,
          0,
          0,
          canvas.width,
          sliceHeight
        );
      }

      const pageImgData = pageCanvas.toDataURL("image/jpeg", 0.95);
      const pageImgHeight = (sliceHeight * printableWidth) / canvas.width;

      if (pageCount > 0) pdf.addPage();
      const x = (pdfWidth - printableWidth) / 2;
      const y = margin;
      pdf.addImage(pageImgData, "JPEG", x, y, printableWidth, pageImgHeight);

      positionY += sliceHeight;
      pageCount++;
    }
  }

  pdf.save(fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`);
}
