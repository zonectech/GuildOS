import { CommunityModel } from '../../models/community.model';
import { EventModel } from '../../models/event.model';
import { HackathonModel } from '../../models/hackathon.model';
import { HackathonTeamModel } from '../../models/hackathon-team.model';
import { HackathonSubmissionModel } from '../../models/hackathon-submission.model';

export type UserHackathonProject = {
  eventTitle: string;
  eventSlug: string;
  communityName: string;
  title: string;
  tagline: string;
  url: string;
  teamSize: number;
  /** Award labels, only once the organizers have published results. */
  awards: string[];
};

/** Every hackathon project the user built, for the CV and profile — newest first. */
export async function listUserHackathonProjects(userId: string): Promise<UserHackathonProject[]> {
  const teams = await HackathonTeamModel.find({ memberIds: userId }).select('_id eventId memberIds').lean();
  if (!teams.length) return [];

  const [submissions, events, hackathons] = await Promise.all([
    HackathonSubmissionModel.find({ teamId: { $in: teams.map((t) => t._id) } }).sort({ createdAt: -1 }).lean(),
    EventModel.find({ _id: { $in: teams.map((t) => t.eventId) }, deletedAt: null }).select('title slug communityId').lean(),
    HackathonModel.find({ eventId: { $in: teams.map((t) => t.eventId) } }).select('eventId awards resultsPublishedAt').lean(),
  ]);
  const communities = await CommunityModel.find({ _id: { $in: events.map((e) => e.communityId) } }).select('name').lean();
  const eventById = new Map(events.map((e) => [e._id.toString(), e]));
  const communityById = new Map(communities.map((c) => [c._id.toString(), c.name]));
  const hackathonByEvent = new Map(hackathons.map((h) => [h.eventId.toString(), h]));
  const teamById = new Map(teams.map((t) => [t._id.toString(), t]));

  return submissions.flatMap((s) => {
    const event = eventById.get(s.eventId.toString());
    if (!event) return [];
    const hackathon = hackathonByEvent.get(s.eventId.toString());
    const awards = hackathon?.resultsPublishedAt
      ? hackathon.awards.filter((a) => a.submissionId.toString() === s._id.toString()).map((a) => a.label)
      : [];
    return [{
      eventTitle: event.title,
      eventSlug: event.slug,
      communityName: communityById.get(event.communityId.toString()) ?? '',
      title: s.title,
      tagline: s.tagline,
      url: s.demoUrl || s.repoUrl,
      teamSize: teamById.get(s.teamId.toString())?.memberIds.length ?? 1,
      awards,
    }];
  });
}
