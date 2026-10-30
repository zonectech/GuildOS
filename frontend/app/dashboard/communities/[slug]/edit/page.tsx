import { DashboardShell } from '../../../../../components/guildos/dashboard/dashboard-shell';
import { DashboardSidebar } from '../../../../../components/guildos/dashboard/dashboard-sidebar';
import { DashboardTopbar } from '../../../../../components/guildos/dashboard/dashboard-topbar';
import { CommunityEditWizard } from '../../../../../components/guildos/community/community-edit-wizard';

export default function EditCommunityPage() {
  return (
    <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
      <CommunityEditWizard />
    </DashboardShell>
  );
}