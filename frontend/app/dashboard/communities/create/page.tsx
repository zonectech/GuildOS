import { DashboardShell } from '../../../../components/guildos/dashboard-shell';
import { DashboardSidebar } from '../../../../components/guildos/dashboard-sidebar';
import { DashboardTopbar } from '../../../../components/guildos/dashboard-topbar';
import { SectionHeader } from '../../../../components/guildos/ui/section-header';
import { CommunityCreationWizard } from '../../../../components/guildos/community-creation-wizard';

export default function CreateCommunityPage() {
  return (
    <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
      <SectionHeader
        eyebrow="Communities"
        title="Create a Community"
        subtitle="Build a student community with verified identity, leadership roles, and event management support."
      />

      <CommunityCreationWizard />
    </DashboardShell>
  );
}
