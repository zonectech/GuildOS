import { Download } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card } from './ui/card';

type CertificatePreviewProps = {
  title: string;
  recipient: string;
  issueDate: string;
  verificationCode: string;
};

export function CertificatePreview({ title, recipient, issueDate, verificationCode }: CertificatePreviewProps) {
  return (
    <Card className="p-6">
      <div className="rounded-[1.5rem] border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6">
        <div className="flex items-center justify-between gap-4">
          <Badge tone="indigo">Verified Certificate</Badge>
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">GuildOS</span>
        </div>

        <div className="mt-10 text-center">
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-slate-500">Certificate of Attendance</p>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">{title}</h2>
          <p className="mt-6 text-sm text-slate-500">Awarded to</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{recipient}</p>
          <p className="mt-6 text-sm text-slate-500">Issued on {issueDate}</p>
          <p className="mt-2 text-sm text-slate-500">Verification Code: {verificationCode}</p>
        </div>

        <div className="mt-10 flex items-center justify-between gap-4 border-t border-slate-200 pt-5">
          <div>
            <p className="text-xs text-slate-500">Issued by GuildOS</p>
            <p className="mt-1 text-sm font-medium text-slate-900">Campus Community Verification</p>
          </div>
          <Button variant="primary">
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
        </div>
      </div>
    </Card>
  );
}
