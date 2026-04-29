import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import Modal from './common/Modal';

export default function ChangePasswordModal({ open, onClose }) {
    const [oldPwd, setOldPwd]   = useState('');
    const [newPwd, setNewPwd]   = useState('');
    const [confirm, setConfirm] = useState('');
    const [busy, setBusy]       = useState(false);

    const reset = () => { setOldPwd(''); setNewPwd(''); setConfirm(''); };

    const submit = async () => {
        if (newPwd.length < 6) {
            toast.error('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
            return;
        }
        if (newPwd !== confirm) {
            toast.error('รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน');
            return;
        }
        setBusy(true);
        try {
            await api.put('/auth/change-password', {
                old_password: oldPwd,
                new_password: newPwd,
            });
            toast.success('เปลี่ยนรหัสผ่านสำเร็จ');
            reset();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.error || 'เปลี่ยนรหัสผ่านล้มเหลว');
        } finally { setBusy(false); }
    };

    return (
        <Modal
            open={open}
            title="เปลี่ยนรหัสผ่าน"
            onClose={() => { reset(); onClose(); }}
            footer={
                <>
                    <button onClick={() => { reset(); onClose(); }}
                            className="px-3 py-1.5 text-sm text-slate-600">ยกเลิก</button>
                    <button onClick={submit} disabled={busy}
                            className="px-3 py-1.5 text-sm bg-brand-600 text-white rounded-md disabled:opacity-50">
                        {busy ? 'กำลังบันทึก...' : 'บันทึก'}
                    </button>
                </>
            }
        >
            <div className="space-y-3 text-sm">
                <Field label="รหัสผ่านเดิม" value={oldPwd} onChange={setOldPwd} />
                <Field label="รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)" value={newPwd} onChange={setNewPwd} />
                <Field label="ยืนยันรหัสผ่านใหม่" value={confirm} onChange={setConfirm} />
            </div>
        </Modal>
    );
}

function Field({ label, value, onChange }) {
    return (
        <label className="block">
            <span className="text-slate-600">{label}</span>
            <input type="password" required
                   className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                   value={value} onChange={(e) => onChange(e.target.value)} />
        </label>
    );
}
