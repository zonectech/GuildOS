'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Trash2, Upload } from 'lucide-react';
import {
  createCommunity, getCommunity, imageUrl, listInstitutions, updateCommunity, schoolProof, sendSchoolCode, uploadCommunityImages, uploadEndorsementLetter, verifySchoolCode,
  type ChatLink, type ChatPlatform, type Institution, type SchoolProof,
} from '@/lib/api';
import { useSession } from '@/lib/session';
import { OptionRow, Panel } from '@/components/panel';
import { DescriptionField } from '@/components/rich-editor/description-field';

const PLATFORMS: { value: ChatPlatform; label: string; placeholder: string; host?: RegExp }[] = [
  { value: 'WHATSAPP', label: 'WhatsApp', placeholder: 'https://chat.whatsapp.com/…', host: /^(chat\.|www\.)?whatsapp\.com$/i },
  { value: 'DISCORD', label: 'Discord', placeholder: 'https://discord.gg/…', host: /^(discord\.gg|(www\.)?discord\.com)$/i },
  { value: 'TELEGRAM', label: 'Telegram', placeholder: 'https://t.me/…', host: /^(t\.me|telegram\.me)$/i },
  { value: 'SLACK', label: 'Slack', placeholder: 'https://join.slack.com/…', host: /^([a-z0-9-]+\.)?slack\.com$/i },
  { value: 'OTHER', label: 'Other', placeholder: 'https://…' },
];
// Same host checks as the backend, so mistakes show here instead of after sending.
function validChat(link: ChatLink) {
  try {
    const url = new URL(link.url.trim());
    const host = PLATFORMS.find((p) => p.value === link.platform)?.host;
    return url.protocol === 'https:' && (!host || host.test(url.hostname));
  } catch { return false; }
}

type PanelName = 'images' | 'school' | 'visibility' | 'verification' | 'review' | null;

function CommunityForm() {
  const router = useRouter();
  const editSlug = useSearchParams().get('edit');
  const { user, loading } = useSession();
  // Edit mode: the community being changed, its current images and school.
  const [editing, setEditing] = useState<{ id: string; slug: string; logo: string; cover: string; university: string; verified: boolean } | null>(null);
  const [name, setName] = useState('');
  const [slogan, setSlogan] = useState('');
  const [category, setCategory] = useState('');
  const [logo, setLogo] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [university, setUniversity] = useState('');
  const [faculty, setFaculty] = useState('');
  const [department, setDepartment] = useState('');
  const [chats, setChats] = useState<ChatLink[]>([{ platform: 'WHATSAPP', url: '' }]);
  const [channel, setChannel] = useState('');
  const [visibility, setVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [autoApprove, setAutoApprove] = useState(true);
  const [method, setMethod] = useState<'UNIVERSITY_EMAIL' | 'MANUAL'>('UNIVERSITY_EMAIL');
  const [letter, setLetter] = useState<File | null>(null);
  const [proof, setProof] = useState<SchoolProof | null>(null);
  const [schoolEmail, setSchoolEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeError, setCodeError] = useState('');
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [panel, setPanel] = useState<PanelName>(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => { if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(editSlug ? `/communities/new?edit=${editSlug}` : '/communities/new')}`); }, [loading, user, router, editSlug]);
  useEffect(() => {
    if (!editSlug || !user) return;
    getCommunity(editSlug).then(({ community: c, viewerMembership }) => {
      if (viewerMembership?.role !== 'FOUNDER') { setError('Only the founder can edit this community.'); return; }
      setName(c.name); setSlogan(c.shortDescription ?? ''); setCategory(c.category ?? ''); setDescription(c.description ?? '');
      setUniversity(c.university ?? ''); setFaculty(c.faculty ?? ''); setDepartment(c.department ?? '');
      const links = (c.chatLinks ?? []).filter((l) => l.url);
      setChats(links.length ? links : c.whatsappLink ? [{ platform: 'WHATSAPP', url: c.whatsappLink }] : [{ platform: 'WHATSAPP', url: '' }]);
      setChannel(c.channelLink ?? ''); setVisibility(c.visibility); setAutoApprove(c.autoApprove ?? true);
      setEditing({ id: c._id, slug: c.slug, logo: c.logo ?? '', cover: c.coverImage ?? '', university: c.university ?? '', verified: c.verificationStatus === 'VERIFIED' });
    }).catch((e: Error) => setError(e.message));
  }, [editSlug, user]);
  useEffect(() => { listInstitutions().then((r) => setInstitutions(r.institutions)).catch(() => undefined); }, []);
  useEffect(() => {
    if (!user || editSlug) return;
    // Wait for typing to pause before checking the school email against the chosen school.
    const timer = setTimeout(() => {
      schoolProof(university).then((p) => { setProof(p); setSchoolEmail((current) => current || p.email); if (!university && (p.matchedSchool || p.profileSchool)) setUniversity(p.matchedSchool || p.profileSchool); }).catch(() => undefined);
    }, 500);
    return () => clearTimeout(timer);
  }, [user, university, editSlug]);

  const logoPreview = useMemo(() => (logo ? URL.createObjectURL(logo) : imageUrl(editing?.logo)), [logo, editing]);
  const coverPreview = useMemo(() => (cover ? URL.createObjectURL(cover) : imageUrl(editing?.cover)), [cover, editing]);
  const basicsDone = Boolean(name.trim() && slogan.trim() && category.trim());
  const imagesDone = Boolean(logo || editing?.logo);
  const descriptionDone = Boolean(description.trim());
  const schoolDone = Boolean(university.trim()) && chats.some((c) => c.url.trim()) && chats.filter((c) => c.url.trim()).every(validChat) && (!channel.trim() || /^https:\/\/\S+$/.test(channel.trim()));
  const verificationDone = Boolean(editing) || Boolean(proof?.verified) || (method === 'MANUAL' && Boolean(letter));
  // Moving to another school sends a verified community back for review.
  const schoolChanged = Boolean(editing) && university.trim() !== editing?.university;
  const allDone = basicsDone && descriptionDone && imagesDone && schoolDone && verificationDone;

  async function sendCode() {
    setCodeBusy(true); setCodeError('');
    try { await sendSchoolCode(schoolEmail.trim()); setCodeSent(true); }
    catch (e) { setCodeError(e instanceof Error ? e.message : 'Unable to send code'); }
    finally { setCodeBusy(false); }
  }
  async function checkCode() {
    setCodeBusy(true); setCodeError('');
    try { await verifySchoolCode(code.trim()); setProof(await schoolProof(university)); setCode(''); setCodeSent(false); }
    catch (e) { setCodeError(e instanceof Error ? e.message : 'Unable to verify code'); }
    finally { setCodeBusy(false); }
  }

  async function submit() {
    const missing = !basicsDone ? 'the name, slogan and category' : !descriptionDone ? 'the description' : !imagesDone ? 'the logo' : !schoolDone ? 'school and chat links' : !verificationDone ? 'verification' : '';
    if (missing) { setError(`Complete ${missing} before sending.`); return; }
    setSending(true); setError('');
    if (editing) {
      try {
        const images = logo || cover ? await uploadCommunityImages(logo, cover) : { logo: '', coverImage: '' };
        const { community } = await updateCommunity(editing.id, {
          name: name.trim(), shortDescription: slogan.trim(), description: description.trim(), category: category.trim(),
          logo: images.logo || editing.logo, coverImage: images.coverImage || editing.cover,
          ...(schoolChanged ? { university: university.trim() } : {}), faculty: faculty.trim(), department: department.trim(),
          chatLinks: chats.map((c) => ({ ...c, url: c.url.trim() })).filter((c) => c.url), channelLink: channel.trim(), visibility, autoApprove,
        });
        router.push(`/communities/${community.slug || editing.slug}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unable to save the community');
        setPanel(null);
      } finally {
        setSending(false);
      }
      return;
    }
    try {
      const images = await uploadCommunityImages(logo as File, cover);
      const endorsementLetter = method === 'MANUAL' && letter && !proof?.verified ? (await uploadEndorsementLetter(letter)).letter : '';
      const { community } = await createCommunity({
        name: name.trim(), shortDescription: slogan.trim(), description: description.trim(), category: category.trim(),
        logo: images.logo, coverImage: images.coverImage || '', university: university.trim(), faculty: faculty.trim(), department: department.trim(),
        chatLinks: chats.map((c) => ({ ...c, url: c.url.trim() })).filter((c) => c.url), channelLink: channel.trim(),
        visibility, autoApprove, verificationMethod: proof?.verified ? 'UNIVERSITY_EMAIL' : method, endorsementLetter,
      });
      router.push(`/communities/${community.slug}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create the community');
      setPanel(null);
    } finally {
      setSending(false);
    }
  }

  const setChat = (i: number, patch: Partial<ChatLink>) => setChats((list) => list.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  return (
    <div className="wrap page">
      <div className="form2">
        <div className="stack" style={{ gap: 12 }}>
          <div className="cpick">
            <label className="cpcover" style={coverPreview ? { backgroundImage: `url(${coverPreview})` } : undefined}>
              <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => setCover(e.target.files?.[0] ?? null)} />
              <span className="up">{cover ? 'Change cover' : 'Upload cover'}</span>
            </label>
            <label className="cplogo" style={logoPreview ? { backgroundImage: `url(${logoPreview})` } : undefined}>
              <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => setLogo(e.target.files?.[0] ?? null)} />
              {logo ? null : <><Plus size={22} /><span>Logo</span></>}
            </label>
          </div>
          <h3>Add community images</h3>
          <p className="small">Use images that help students recognise your community.</p>
        </div>
        <div className="stack" style={{ gap: 14 }}>
          <h1>{editing ? 'Edit community' : 'Create a community'}</h1>
          <label className="field"><span>Community Name <em>*</em></span><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="field"><span>Slogan <em>*</em></span><input className="input" placeholder="A short line about your community" value={slogan} onChange={(e) => setSlogan(e.target.value)} /></label>
          <label className="field"><span>Category <em>*</em></span><input className="input" placeholder="For example Technology" value={category} onChange={(e) => setCategory(e.target.value)} /></label>
          <DescriptionField label="Description" required value={description} onChange={setDescription} placeholder="Tell students what your community does, who it is for and how to get involved." />
          <div>
            <OptionRow label="Logo & cover" value={imagesDone ? (cover ? 'Logo and cover added' : 'Logo added') : 'Add your logo'} done={imagesDone} required onClick={() => setPanel('images')} />
            <OptionRow label="School & chat links" value={schoolDone ? [university, chats[0]?.platform === 'WHATSAPP' ? 'WhatsApp' : chats[0]?.platform].filter(Boolean).join(', ') : 'Add school and chat link'} done={schoolDone} required onClick={() => setPanel('school')} />
            <OptionRow label="Visibility & joining" value={`${visibility === 'PUBLIC' ? 'Public' : 'Private'}${autoApprove ? ', auto-approve members' : ''}`} done required onClick={() => setPanel('visibility')} />
            {!editing ? <OptionRow label="Verification" value={proof?.verified ? 'School email confirmed' : method === 'MANUAL' ? (letter ? 'Endorsement letter added' : 'Upload an endorsement letter') : 'Verify your university email'} done={verificationDone} required onClick={() => setPanel('verification')} /> : null}
            <OptionRow label="Review" value="Check everything before sending" onClick={() => setPanel('review')} />
          </div>
          <p className="small">Open only the settings you need. Required details are checked before creating your community.</p>
          {error ? <p className="error" role="alert">{error}</p> : null}
          <div className="row"><button type="button" className="btn p" onClick={() => setPanel('review')} disabled={sending || (Boolean(editSlug) && !editing)}>{editing ? 'Review changes' : 'Review details'}</button>{editing ? <a className="btn s" href={`/communities/${editing.slug}`}>Cancel</a> : null}</div>
        </div>
      </div>

      <Panel open={panel === 'images'} title="Logo & cover" onClose={() => setPanel(null)}>
        <label className="field"><span>Community Logo <em>*</em></span><span className="drop"><Upload size={18} />{logo ? logo.name : 'Upload image'}<input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => setLogo(e.target.files?.[0] ?? null)} /></span></label>
        <label className="field"><span>Cover Image (Optional)</span><span className="drop"><Upload size={18} />{cover ? cover.name : 'Upload image'}<input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => setCover(e.target.files?.[0] ?? null)} /></span></label>
      </Panel>

      <Panel open={panel === 'school'} title="School & chat links" onClose={() => setPanel(null)}>
        <label className="field"><span>University <em>*</em></span><input className="input" list="schools" value={university} onChange={(e) => setUniversity(e.target.value)} /><datalist id="schools">{institutions.map((i) => <option key={i._id} value={i.name} />)}</datalist></label>
        <div className="two"><label className="field"><span>Faculty (Optional)</span><input className="input" value={faculty} onChange={(e) => setFaculty(e.target.value)} /></label><label className="field"><span>Department (Optional)</span><input className="input" value={department} onChange={(e) => setDepartment(e.target.value)} /></label></div>
        <span className="field"><span>Chat links <em>*</em></span></span>
        {chats.map((c, i) => (
          <div key={i} className="two chat">
            <select className="input" aria-label="Chat platform" value={c.platform} onChange={(e) => setChat(i, { platform: e.target.value as ChatPlatform })}>{PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select>
            <span className="row" style={{ flexWrap: 'nowrap' }}>
              <input className="input" aria-label="Chat link" placeholder={PLATFORMS.find((p) => p.value === c.platform)?.placeholder} value={c.url} onChange={(e) => setChat(i, { url: e.target.value })} aria-invalid={Boolean(c.url.trim()) && !validChat(c)} />
              {chats.length > 1 ? <button type="button" className="btn s sm" aria-label="Remove link" onClick={() => setChats((list) => list.filter((_, j) => j !== i))}><Trash2 size={15} /></button> : null}
            </span>
          </div>
        ))}
        {chats.some((c) => c.url.trim() && !validChat(c)) ? <p className="small" style={{ color: 'var(--clay)' }}>Use a full https link for the chosen platform.</p> : null}
        {chats.length < 5 ? <button type="button" className="btn s sm" style={{ alignSelf: 'flex-start' }} onClick={() => setChats((list) => [...list, { platform: 'WHATSAPP', url: '' }])}><Plus size={15} />Add another link</button> : null}
        <label className="field"><span>Channel link (Optional)</span><input className="input" placeholder="https://whatsapp.com/channel/… or Telegram/Discord" value={channel} onChange={(e) => setChannel(e.target.value)} /></label>
      </Panel>

      <Panel open={panel === 'visibility'} title="Visibility & joining" onClose={() => setPanel(null)}>
        <span className="field"><span>Visibility <em>*</em></span></span>
        {(['PUBLIC', 'PRIVATE'] as const).map((v) => (
          <label key={v} className={`rad${visibility === v ? ' on' : ''}`}><input type="radio" name="visibility" checked={visibility === v} onChange={() => setVisibility(v)} /><span className="stack" style={{ gap: 2 }}><b>{v === 'PUBLIC' ? 'Public' : 'Private'}</b><span className="small">{v === 'PUBLIC' ? 'Anyone can find and view this community.' : 'Only members can see inside.'}</span></span></label>
        ))}
        <span className="field"><span>Join Approval</span></span>
        <label className="tog"><span>Auto-approve new members</span><input type="checkbox" checked={autoApprove} onChange={(e) => setAutoApprove(e.target.checked)} /></label>
      </Panel>

      <Panel open={panel === 'verification'} title="Verification" onClose={() => setPanel(null)}>
        {proof?.verified ? <p className="note">School email confirmed: {proof.email}{proof.selectedMatches ? '. It matches this school.' : '. An admin will check the school match.'}</p> : null}
        <span className="field"><span>Verification Method <em>*</em></span></span>
        <label className={`rad${method === 'UNIVERSITY_EMAIL' ? ' on' : ''}`}>
          <input type="radio" name="method" checked={method === 'UNIVERSITY_EMAIL'} onChange={() => setMethod('UNIVERSITY_EMAIL')} />
          <span className="stack" style={{ gap: 6 }}>
            <b>Verify university email</b>
            <span className="small">Verify your school inbox with a code. Previously verified school emails are reused. An admin reviews the community and school match.</span>
            {method === 'UNIVERSITY_EMAIL' && !proof?.verified ? (
              <span className="stack" style={{ gap: 8 }}>
                <span className="field"><span>School email</span><input className="input" type="email" value={schoolEmail} onChange={(e) => setSchoolEmail(e.target.value)} placeholder="name@university.edu.ng" /></span>
                <button type="button" className="btn s sm" style={{ alignSelf: 'flex-start' }} disabled={codeBusy || !schoolEmail.trim()} onClick={sendCode}>{codeSent ? 'Send a new code' : 'Send verification code'}</button>
                {codeSent ? <><span className="field"><span>Verification code</span><input className="input" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} /></span><span className="small">Code sent. Enter the six digits from your school inbox.</span><button type="button" className="btn p sm" style={{ alignSelf: 'flex-start' }} disabled={codeBusy || code.length !== 6} onClick={checkCode}>Verify code</button></> : null}
                {codeError ? <span className="small" style={{ color: 'var(--clay)' }}>{codeError}</span> : null}
              </span>
            ) : null}
          </span>
        </label>
        <label className={`rad${method === 'MANUAL' ? ' on' : ''}`}>
          <input type="radio" name="method" checked={method === 'MANUAL'} onChange={() => setMethod('MANUAL')} />
          <span className="stack" style={{ gap: 6 }}>
            <b>Endorsement letter</b>
            <span className="small">No matching university email? Upload an endorsement letter written by a recognized leader: a professor, political office holder, SUG or MSSN leader, or any known leadership from an institution or organization. A GuildOS admin reviews it.</span>
            {method === 'MANUAL' ? <span className="drop"><Upload size={18} />{letter ? letter.name : 'Upload letter (PDF or image)'}<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" hidden onChange={(e) => setLetter(e.target.files?.[0] ?? null)} /></span> : null}
          </span>
        </label>
      </Panel>

      <Panel open={panel === 'review'} title="Review" onClose={() => setPanel(null)} footer={<button type="button" className="btn p" onClick={submit} disabled={sending || !allDone}>{sending ? 'Saving…' : editing ? 'Save changes' : 'Create community'}</button>}>
        {[['Name', name], ['Slogan', slogan], ['Category', category], ['University', university], ['Chat links', chats.filter((c) => c.url.trim()).map((c) => PLATFORMS.find((p) => p.value === c.platform)?.label).join(', ')], ['Visibility', visibility === 'PUBLIC' ? 'Public' : 'Private'], ...(editing ? [] : [['Verification Method', proof?.verified || method === 'UNIVERSITY_EMAIL' ? 'University email' : 'Endorsement letter']])].map(([k, v]) => (
          <div key={k} className="kv"><span>{k}</span><b>{v || 'Missing'}</b></div>
        ))}
        {schoolChanged && editing?.verified ? <p className="note">You changed the school. Your community goes back to our team for review, and new events wait until it is approved again.</p> : null}
        {!allDone ? <p className="small" style={{ color: 'var(--clay)' }}>Finish every row marked * before {editing ? 'saving' : 'creating the community'}.</p> : editing ? null : <p className="small">An admin reviews your community once. After that you can run events with no more approval.</p>}
      </Panel>
    </div>
  );
}

export default function CommunityFormPage() {
  return <Suspense fallback={<div className="wrap page"><p className="empty">Loading…</p></div>}><CommunityForm /></Suspense>;
}
