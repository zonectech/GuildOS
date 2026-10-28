export function assertCertificateAttendance(event: {certificateEnabled?:boolean;attendanceSource?:string;qrEnabled?:boolean}) {
 if(event.certificateEnabled && event.attendanceSource !== 'EXTERNAL' && !event.qrEnabled) throw new Error('Enable GuildOS check-in or external attendance before enabling or issuing certificates');
}

