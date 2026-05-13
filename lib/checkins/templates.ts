/**
 * Email templates for the Premium check-in cadence.
 *
 * Each template returns subject + html + text. Text is required because
 * Gmail's "view text version" matters more than people think — also some
 * corporate gateways nuke HTML.
 *
 * Voice rules (calibrated to the Step product voice — direct, senior peer,
 * not coachy):
 *   - Second person, never "we believe" or "you should".
 *   - Specific over generic. "Did you ship something visible?" beats
 *     "How is progress going?".
 *   - Always one (1) call to action, never two.
 *   - No emojis. No exclamation marks. No "🚀".
 *   - Sign-off is "— Step", lowercase, no logo PNGs.
 *
 * The dilemma here: free-floating check-ins risk feeling like
 * spam. To earn each open, every email needs a fresh angle and a
 * concrete prompt — not "how's it going?".
 */
import { CHECKIN_ANSWERS, type AnswerOption } from "./answers";
import type { CheckinDay } from "./schedule";

export type CheckinTemplateArgs = {
  /** First name if known, otherwise empty string. */
  firstName: string;
  /** Plan title — used to anchor each email to a specific plan. */
  planTitle: string;
  /** Absolute URL to /account/plans/[id] for that plan. */
  planUrl: string;
  /** Absolute one-click unsubscribe URL (HMAC-signed). */
  unsubscribeUrl: string;
  /**
   * URL-builder for a single answer-button: given (day, answer key) it
   * returns the absolute HMAC-signed URL that records that reply. Built
   * by the cron handler since it owns the signing secret.
   */
  buildAnswerUrl: (day: CheckinDay, answerKey: string) => string;
};

type Template = {
  subject: string;
  html: string;
  text: string;
};

/**
 * Render the 3-4 answer buttons for a given day. Returns HTML + text
 * fragments to splice into each template.
 */
function answerButtons(
  day: CheckinDay,
  args: CheckinTemplateArgs,
): { html: string; text: string } {
  const options: AnswerOption[] = CHECKIN_ANSWERS[day];
  const buttonsHtml = options
    .map(
      (opt) => `
      <a href="${args.buildAnswerUrl(day, opt.key)}"
         style="display:inline-block;margin:0 8px 8px 0;padding:10px 16px;border-radius:8px;border:1px solid #d4d4d8;background:#fafafa;color:#111;text-decoration:none;font-size:14px;font-weight:600">${opt.label}</a>
    `,
    )
    .join("");

  const html = `<div style="margin:20px 0 8px 0">
      <p style="margin:0 0 10px 0;font-size:13px;color:#525252;text-transform:uppercase;letter-spacing:0.06em;font-weight:600">One click — tell us where you are</p>
      ${buttonsHtml}
    </div>`;

  const text = `\nQuick answer (just click one):\n${options
    .map((opt) => `  · ${opt.label} → ${args.buildAnswerUrl(day, opt.key)}`)
    .join("\n")}\n`;

  return { html, text };
}

function commonFooter(unsubscribeUrl: string): { html: string; text: string } {
  return {
    html: `<p style="margin-top:32px;font-size:12px;color:#9a9a9a;line-height:1.5">
      Getting these because you're a Step Premium member. One click to stop:
      <a href="${unsubscribeUrl}" style="color:#9a9a9a;text-decoration:underline">unsubscribe from check-ins</a>.
      Transactional emails (receipts, sign-in links) won't be affected.
    </p>`,
    text: `\n\n—\nGetting these because you're a Step Premium member.\nUnsubscribe from check-ins: ${unsubscribeUrl}\nTransactional emails (receipts, sign-in links) won't be affected.`,
  };
}

function wrap(
  args: CheckinTemplateArgs,
  day: CheckinDay,
  subject: string,
  body: string,
  bodyText: string,
): Template {
  const buttons = answerButtons(day, args);
  const footer = commonFooter(args.unsubscribeUrl);
  const html = `<!doctype html>
<html><body style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;max-width:560px;margin:24px auto;padding:0 16px">
${body}
${buttons.html}
${footer.html}
</body></html>`;
  const text = `${bodyText}${buttons.text}\n\n— Step${footer.text}`;
  return { subject, html, text };
}

function greeting(firstName: string): string {
  return firstName ? `Hey ${firstName},` : "Hey,";
}

function planLink(args: CheckinTemplateArgs): string {
  return `<a href="${args.planUrl}" style="color:#0b0b0c;font-weight:600;text-decoration:underline">${args.planTitle}</a>`;
}

const TEMPLATES: Record<CheckinDay, (args: CheckinTemplateArgs) => Template> = {
  // Day 1 — fast, low-pressure. The only goal here is to lower the activation
  // barrier: "doing 5 minutes is the win".
  1: (a) =>
    wrap(
      a,
      1,
      "Day 1 — start one thing, even if it's small",
      `<p>${greeting(a.firstName)}</p>
<p>Yesterday you generated this plan: ${planLink(a)}</p>
<p>Pick the smallest piece of the foundation move and do 5 minutes of it
today. Open the doc. Send the message. Schedule the call. Don't try to
finish anything — just start the first action so it's no longer in
"someday" land.</p>
<p>You can re-open the plan anytime: <a href="${a.planUrl}">${a.planUrl}</a></p>
<p>— Step</p>`,
      `${greeting(a.firstName)}

Yesterday you generated this plan: ${a.planTitle}
${a.planUrl}

Pick the smallest piece of the foundation move and do 5 minutes of it
today. Open the doc. Send the message. Schedule the call. Don't try to
finish anything — just start the first action so it's no longer in
"someday" land.`,
    ),

  // Day 3 — first friction check. Most plans die between day 2 and 5.
  3: (a) =>
    wrap(
      a,
      3,
      "Day 3 — what got in the way?",
      `<p>${greeting(a.firstName)}</p>
<p>Three days in. If you haven't started the foundation move on
${planLink(a)} yet, that's the most common pattern — it's also the most
fixable.</p>
<p>Reply to this email with one sentence: <strong>what's the actual
obstacle?</strong> Time, courage, unclear next step, something else? No
forwarded analysis, just the real one. We read every reply.</p>
<p>— Step</p>`,
      `${greeting(a.firstName)}

Three days in. If you haven't started the foundation move on
"${a.planTitle}" yet, that's the most common pattern — it's also the
most fixable.

Reply with one sentence: what's the actual obstacle? Time, courage,
unclear next step, something else? No forwarded analysis, just the
real one. We read every reply.`,
    ),

  // Day 7 — first real reflection. They've had a week. Something happened.
  7: (a) =>
    wrap(
      a,
      7,
      "Week 1 — what surprised you?",
      `<p>${greeting(a.firstName)}</p>
<p>Week 1 on ${planLink(a)}. Even tiny progress reveals things the plan
didn't know about your situation.</p>
<p>Two questions:</p>
<ol>
<li><strong>What did you actually do</strong> in the first week?</li>
<li><strong>What surprised you</strong> — easier, harder, or different
from expected?</li>
</ol>
<p>Reply with two short paragraphs and we'll use it to tune the plan
when you come back to refresh it.</p>
<p>— Step</p>`,
      `${greeting(a.firstName)}

Week 1 on "${a.planTitle}". Even tiny progress reveals things the
plan didn't know about your situation.

Two questions:
1. What did you actually do in the first week?
2. What surprised you — easier, harder, or different from expected?

Reply with two short paragraphs and we'll use it to tune the plan
when you come back to refresh it.

${a.planUrl}`,
    ),

  // Day 14 — pivot check. Two weeks is enough to know if the foundation
  // is right or if it needs to change.
  14: (a) =>
    wrap(
      a,
      14,
      "Two weeks in — is the foundation still right?",
      `<p>${greeting(a.firstName)}</p>
<p>You're 14 days into ${planLink(a)}. By now you've either confirmed
the foundation move is the right one — or you've noticed it isn't.</p>
<p>If something's off, this is the cheapest time to pivot. Reply with
one line: <strong>"still on it"</strong>, <strong>"need to adjust"</strong>,
or <strong>"want a fresh plan"</strong>. The "fresh plan" path takes
2 minutes and uses what we've learned from your replies.</p>
<p>— Step</p>`,
      `${greeting(a.firstName)}

You're 14 days into "${a.planTitle}". By now you've either confirmed
the foundation move is the right one — or you've noticed it isn't.

If something's off, this is the cheapest time to pivot. Reply with
one line: "still on it", "need to adjust", or "want a fresh plan".
The "fresh plan" path takes 2 minutes and uses what we've learned
from your replies.

${a.planUrl}`,
    ),

  // Day 30 — first visible outcome. Reasonable expectation: one thing
  // shipped, one conversation had, one application sent.
  30: (a) =>
    wrap(
      a,
      30,
      "Month 1 — what's visible from outside?",
      `<p>${greeting(a.firstName)}</p>
<p>A month in on ${planLink(a)}. The honest test of a 90-day move at
this point: <strong>what can someone else see</strong>?</p>
<p>A shipped artifact, a new conversation in your calendar, a public
post, a recruiter screen booked, a course halfway done. Not internal
progress — external proof.</p>
<p>Reply with the one external thing that exists today and didn't
30 days ago. If the answer is "nothing yet", that's still data and
worth saying — we can help you find a faster path.</p>
<p>— Step</p>`,
      `${greeting(a.firstName)}

A month in on "${a.planTitle}". The honest test of a 90-day move at
this point: what can someone else see?

A shipped artifact, a new conversation in your calendar, a public
post, a recruiter screen booked, a course halfway done. Not internal
progress — external proof.

Reply with the one external thing that exists today and didn't 30
days ago. If the answer is "nothing yet", that's still data and
worth saying — we can help you find a faster path.

${a.planUrl}`,
    ),

  // Day 60 — momentum check. 30 more days and the 90-day window closes.
  60: (a) =>
    wrap(
      a,
      60,
      "Day 60 — 30 days left on the 90-day window",
      `<p>${greeting(a.firstName)}</p>
<p>You're two-thirds through the 90-day phase of ${planLink(a)}. The
final 30 days are usually where the foundation move either compounds
or stalls.</p>
<p>If you've shipped something visible, the move now is to convert it
into one specific conversation — a recruiter, a hiring manager, an
investor, a peer who can vouch. Tools without conversations don't
move careers.</p>
<p>If you haven't shipped yet, drop scope. Whatever the smallest version
is, it's still smaller than you think.</p>
<p>— Step</p>`,
      `${greeting(a.firstName)}

You're two-thirds through the 90-day phase of "${a.planTitle}". The
final 30 days are usually where the foundation move either compounds
or stalls.

If you've shipped something visible, the move now is to convert it
into one specific conversation — a recruiter, a hiring manager, an
investor, a peer who can vouch. Tools without conversations don't
move careers.

If you haven't shipped yet, drop scope. Whatever the smallest version
is, it's still smaller than you think.

${a.planUrl}`,
    ),

  // Day 90 — major reflection. Plan window closes. Offer a refresh.
  90: (a) =>
    wrap(
      a,
      90,
      "Quarter review — refresh the plan?",
      `<p>${greeting(a.firstName)}</p>
<p>${planLink(a)} hit its 90-day mark today. Original purpose: validate
the foundation move and produce one piece of external proof.</p>
<p>Two paths from here:</p>
<ul>
<li><strong>If the foundation worked</strong> — generate a new plan
that anchors on what you've built and pushes toward the 12-month
outcome.</li>
<li><strong>If it didn't</strong> — generate a fresh plan that uses
what you've learned to pick a different foundation. The replies
you've sent to these emails are part of the input.</li>
</ul>
<p>Both routes start the same way: <a href="https://step.careers/beta"
style="color:#0b0b0c;font-weight:600;text-decoration:underline">refresh
your plan</a>.</p>
<p>— Step</p>`,
      `${greeting(a.firstName)}

"${a.planTitle}" hit its 90-day mark today. Original purpose: validate
the foundation move and produce one piece of external proof.

Two paths from here:
- If the foundation worked — generate a new plan that anchors on what
  you've built and pushes toward the 12-month outcome.
- If it didn't — generate a fresh plan that uses what you've learned
  to pick a different foundation. The replies you've sent to these
  emails are part of the input.

Both routes start the same way: refresh your plan.
https://step.careers/beta`,
    ),

  // Day 180 — half-year. Reflection on the 12-month arc.
  180: (a) =>
    wrap(
      a,
      180,
      "Halfway to the 12-month outcome — still on track?",
      `<p>${greeting(a.firstName)}</p>
<p>${planLink(a)} projected a 12-month outcome — at 6 months you're
halfway there, give or take.</p>
<p>The honest check: if you imagine yourself in another 6 months, are
you going to actually hit that outcome, or do you already know the
projection was off?</p>
<p>If yes, keep going — the second half compounds faster than the
first.</p>
<p>If you can already tell it's off, that's worth saying out loud.
Reply with what you'd revise the 12-month line to, given what you now
know. We use those revisions to make the recommender sharper for the
next person in your shoes.</p>
<p>— Step</p>`,
      `${greeting(a.firstName)}

"${a.planTitle}" projected a 12-month outcome — at 6 months you're
halfway there, give or take.

The honest check: if you imagine yourself in another 6 months, are
you going to actually hit that outcome, or do you already know the
projection was off?

If yes, keep going — the second half compounds faster than the first.

If you can already tell it's off, that's worth saying out loud. Reply
with what you'd revise the 12-month line to, given what you now know.
We use those revisions to make the recommender sharper for the next
person in your shoes.

${a.planUrl}`,
    ),

  // Day 365 — one year. The big retrospective. Final touchpoint in cadence.
  365: (a) =>
    wrap(
      a,
      365,
      "One year on — how did it actually go?",
      `<p>${greeting(a.firstName)}</p>
<p>One year ago today you generated ${planLink(a)}. The 12-month
outcome the plan predicted: did you hit it, miss it, or land somewhere
unexpected?</p>
<p>This is the last automated note you'll get on this plan. If you
have 90 seconds, reply with the one-line truth about where you
actually landed. We use these stories as evidence in future plans —
anonymized, never attributed — to make recommendations more honest.</p>
<p>If you're ready for the next chapter, the planner is here:
<a href="https://step.careers/beta" style="color:#0b0b0c;font-weight:600;text-decoration:underline">step.careers/beta</a>.</p>
<p>— Step</p>`,
      `${greeting(a.firstName)}

One year ago today you generated "${a.planTitle}". The 12-month
outcome the plan predicted: did you hit it, miss it, or land somewhere
unexpected?

This is the last automated note you'll get on this plan. If you have
90 seconds, reply with the one-line truth about where you actually
landed. We use these stories as evidence in future plans —
anonymized, never attributed — to make recommendations more honest.

If you're ready for the next chapter, the planner is here:
https://step.careers/beta

${a.planUrl}`,
    ),
};

export function buildCheckinEmail(
  day: CheckinDay,
  args: CheckinTemplateArgs,
): Template {
  return TEMPLATES[day](args);
}
