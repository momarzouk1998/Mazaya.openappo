'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ name: string; email: string; role: string; branch_name: string } | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [changing, setChanging] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: prof } = await supabase
          .from('profiles')
          .select('name, email, role, branch_id')
          .eq('id', user.id)
          .single();

        let branch_name = '-';
        if (prof?.branch_id) {
          const { data: branch } = await supabase
            .from('branches').select('name').eq('id', prof.branch_id).single();
          if (branch) branch_name = branch.name;
        }

        setProfile({
          name: prof?.name || user.email || '',
          email: prof?.email || user.email || '',
          role: prof?.role || 'admin',
          branch_name,
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [supabase]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    if (newPassword.length < 6) {
      setMessage('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      setMessageType('error');
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage('كلمتا المرور غير متطابقتين');
      setMessageType('error');
      return;
    }

    setChanging(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setMessage(error.message);
        setMessageType('error');
      } else {
        setMessage('تم تغيير كلمة المرور بنجاح');
        setMessageType('success');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch {
      setMessage('حدث خطأ في الاتصال');
      setMessageType('error');
    } finally {
      setChanging(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">الملف الشخصي</h1>
          <p className="text-sm text-gray-500 mt-1">عرض بياناتك وتغيير كلمة المرور</p>
        </div>

        {/* Profile Info */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-4 pb-4 mb-4 border-b border-gray-100">
            <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-xl font-bold">
              {profile?.name?.charAt(0) || '?'}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{profile?.name}</h2>
              <p className="text-sm text-gray-500">{profile?.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">الدور</span>
              <p className="font-medium text-gray-900 mt-0.5">
                {profile?.role === 'admin' ? 'مدير' : 'معرض'}
              </p>
            </div>
            <div>
              <span className="text-gray-500">المعرض</span>
              <p className="font-medium text-gray-900 mt-0.5">{profile?.branch_name}</p>
            </div>
          </div>
        </div>

        {/* Change Password */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-bold text-gray-900 mb-4">تغيير كلمة المرور</h2>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">كلمة المرور الجديدة</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">تأكيد كلمة المرور</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
              />
            </div>

            {message && (
              <div className={`px-4 py-3 rounded-lg text-sm ${
                messageType === 'success'
                  ? 'bg-green-50 border border-green-200 text-green-700'
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}>
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={changing}
              className="w-full py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {changing && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {changing ? 'جاري التغيير...' : 'تغيير كلمة المرور'}
            </button>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
