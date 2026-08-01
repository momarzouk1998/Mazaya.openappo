"use client";
import PageHelp from "@/components/ui/PageHelp";
import Link from "next/link";
import { ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  helpTitle?: string;
  helpDescription?: string;
  actions?: ReactNode;
  backHref?: string;
}
export default function PageHeader({ title, subtitle, helpTitle, helpDescription, actions, backHref }: Props) {
  return (
    <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
      <div className="flex items-start gap-3">
        {backHref && (
          <Link href={backHref} className="p-2 -m-2 text-gray-500 hover:text-brand-orange transition" aria-label="رجوع">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
        )}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-brand-black">{title}</h1>
          {subtitle && <p className="text-gray-500 mt-1 text-sm md:text-base">{subtitle}</p>}
        </div>
        {helpTitle && helpDescription && (
          <PageHelp title={helpTitle} description={helpDescription} />
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
