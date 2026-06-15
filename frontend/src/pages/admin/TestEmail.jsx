import { useState } from 'react';
import api from '../../api/axios';

const EMAIL_TYPES = [
  ['test', '✅ Basic Test Email'],
  ['welcome', '🎉 Patient Welcome'],
  ['approval_request', '⏳ Admin — New Application Pending'],
  ['approved', '✅ Account Approved'],
  ['rejected', '❌ Account Rejected'],
  ['appointment', '📅 Appointment Confirmed'],
  ['emergency', '🚨 Emergency Alert'],
  ['prescription', '💊 Prescription Issued'],
];

const TRIGGERS = [
  ['Patient registers', 'Patient', 'Welcome email with NHS ID', '✅ Active'],
  ['Doctor/Gov registers', 'Applicant', 'Application received — pending review', '✅ Active'],
  ['Doctor/Gov registers', 'Admin', 'New application pending approval (with details)', '✅ Active'],
  ['Admin approves account', 'Doctor / Gov Analyst', 'Account approved — login now', '✅ Active'],
  ['Admin rejects account', 'Doctor / Gov Analyst', 'Rejection with reason', '✅ Active'],
  ['Appointment booked', 'Patient', 'Appointment confirmation with details', '✅ Active'],
  ['Appointment booked', 'Doctor', 'New patient appointment notification', '✅ Active'],
  ['Emergency chat message', 'Doctor', '🚨 Urgent alert email with message preview', '✅ Active'],
  ['Appointment cancelled', 'Patient', 'Cancellation confirmation', '✅ Active'],
  ['Prescription issued', 'Patient', 'New prescription details', 'Available'],
  ['Critical lab result', 'Patient', 'Urgent lab result alert', 'Available'],
];

export default function TestEmail() {
  const [to, setTo] = useState('');
  const [type, setType] = useState('test');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    setResult(null);
    try {
      const { data } = await api.post('/admin/test-email', { type, to: to.trim() || undefined });
      setResult({ ok: data.success, to: data.to });
    } catch (err) {
      setResult({ ok: false, to });
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      {result && (
        result.ok ? (
          <div style={{ background: '#DCFCE7', border: '1px solid #BBF7D0', borderRadius: 10, padding: '14px 18px', marginBottom: 16, color: '#166534', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
            <i className="fas fa-check-circle fa-lg" /> Email sent successfully! Check the inbox at <strong>{result.to}</strong>
          </div>
        ) : (
          <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 10, padding: '14px 18px', marginBottom: 16, color: '#991B1B', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
            <i className="fas fa-exclamation-circle fa-lg" /> Email sending failed. Check SMTP credentials in the backend environment.
          </div>
        )
      )}

      <div className="grid grid-2 gap-2" style={{ maxWidth: 900 }}>
        <div className="card">
          <div className="card-header"><span className="card-title">📨 Send Test Email</span></div>
          <form onSubmit={submit}>
            <div style={{ padding: 20 }}>
              <div className="form-group">
                <label className="form-label">Send To</label>
                <input type="email" className="form-control" placeholder="recipient@example.com (defaults to admin)" value={to} onChange={e => setTo(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Email Type</label>
                <select className="form-control" value={type} onChange={e => setType(e.target.value)}>
                  {EMAIL_TYPES.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                </select>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={sending}>
                <i className="fas fa-paper-plane" /> {sending ? 'Sending...' : 'Send Test Email'}
              </button>
            </div>
          </form>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">🔧 Email Configuration</span></div>
          <div style={{ padding: 20, fontSize: 13, color: 'var(--text-muted)' }}>
            <p>Email is sent via SMTP using the credentials configured in the backend's environment variables (<code>SMTP_HOST</code>, <code>SMTP_PORT</code>, <code>SMTP_USER</code>, <code>SMTP_PASS</code>, <code>EMAIL_FROM</code>).</p>
            <p>Use the form to verify your SMTP configuration and preview each automated email template.</p>
          </div>
        </div>
      </div>

      <div className="card mt-4" style={{ maxWidth: 900 }}>
        <div className="card-header"><span className="card-title">🗺️ Automated Email Triggers</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Trigger Event</th><th>Recipient</th><th>Template</th><th>Status</th></tr></thead>
            <tbody>
              {TRIGGERS.map(([event, recipient, template, status], i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{event}</td>
                  <td>{recipient}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{template}</td>
                  <td><span className={`badge ${status.startsWith('✅') ? 'badge-success' : 'badge-gray'}`}>{status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
