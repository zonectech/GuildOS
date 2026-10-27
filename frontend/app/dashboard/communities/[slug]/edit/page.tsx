import { DashboardShell } from '../../../../../components/guildos/dashboard-shell';
import { DashboardSidebar } from '../../../../../components/guildos/dashboard-sidebar';
import { DashboardTopbar } from '../../../../../components/guildos/dashboard-topbar';
import { CommunityEditWizard } from '../../../../../components/guildos/community-edit-wizard';

export default function EditCommunityPage() {
  return (
    <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
      <CommunityEditWizard />
    </DashboardShell>
  );
}