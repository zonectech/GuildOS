import { DashboardShell } from '../../../../../components/guildos/dashboard-shell';
import { DashboardSidebar } from '../../../../../components/guildos/dashboard-sidebar';
import { DashboardTopbar } from '../../../../../components/guildos/dashboard-topbar';
import { SectionHeader } from '../../../../../components/guildos/ui/section-header';
import { CommunityEditWizard } from '../../../../../components/guildos/community-edit-wizard';

export default function EditCommunityPage() {
  return (
    <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
      <SectionHeader
        eyebrow="Communities"
        title="Edit Community"
        subtitle="Update your community profile, images, and visibility settings."
      />

      <CommunityEditWizard />
    </DashboardShell>
  );
}