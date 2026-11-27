import { useSession } from "../lib/session.tsx";

/**
 * Which campaign the page is for: the Characters list, Encounters and new characters follow it. Shown once there's more
 * than one campaign to choose from (admins can also choose every campaign at once).
 */
export function CampaignSelect({ label = "Campaign" }: { label?: string }) {
  const session = useSession();
  const mine = session.isAdmin ? session.campaigns : session.campaigns.filter((c) => session.campaignMembers.some((m) => m.campaign_id === c.id && m.user_id === session.user?.id));
  if (mine.length + (session.isAdmin ? 1 : 0) < 2) return null;
  return (
    <label className="campsel">
      <span className="muted">{label}</span>
      <select value={session.campaignId} aria-label={label} onChange={(e) => session.setCampaignId(e.target.value)}>
        {session.isAdmin && <option value="">Every campaign</option>}
        {mine.map((c) => <option key={c.id} value={c.id}>{c.name || "Unnamed campaign"}</option>)}
      </select>
    </label>
  );
}

/** The campaigns a character can go into: the ones its owner is in (admins: any), so their group can see it. */
export function useCampaignChoices(owner?: string) {
  const session = useSession();
  if (session.isAdmin) return session.campaigns;
  return session.campaigns.filter((c) => session.campaignMembers.some((m) => m.campaign_id === c.id && m.user_id === (owner || session.user?.id)));
}
