# Email to John, 6 August 2026 — the staging site, before the meeting

Drafted for Ole to send. Written to be read once, on a phone, before a meeting: what the site is,
what to look at, how he will edit it, and the one part that is not finished yet.

It deliberately does NOT ask him the copy questions — those are in
[copy-to-confirm.md](../copy-to-confirm.md) and belong in a calmer email, or in the meeting itself.
The only thing it asks for is a look.

---

**Subject:** Your new site — have a look before we talk

Hi John,

Here it is: **https://gosscounselling-co-uk.stage.denfrievilje.dk**

It is not public. Search engines are told to ignore it, and the address is not linked from
anywhere, so nobody finds it unless you send it to them. The real address, gosscounselling.co.uk,
still points at your old site and will keep doing so until you say otherwise.

**What to look at.** Read it as one page, top to bottom, on your phone. It is deliberately one
scroll rather than a site with a lot of pages: everything someone needs before they ring you is on
it, in the order they would ask. What I would like from you is the same thing you gave me on the
first drafts — where does it sound like you, and where does it sound like a website.

Three specific things worth your eye:

- **The words are yours.** Almost everything on it came off your old site, sometimes trimmed. There
  is a short list of lines that are mine and not yours — a handful of sentences where the site
  needed something and you had not written it. I will go through those with you rather than leave
  them sitting there pretending to be yours.
- **Your fees are as your old site had them.** If any of them have moved, that is the first thing
  to fix, because it is the number people decide on.
- **The photograph.** It is the one from your old site, cut out and placed on the blue circle. You
  mentioned you might get new ones taken — worth doing, and there is a note further down about what
  makes a photograph work here.

**How you will edit it.** Not by emailing me changes. The site has an editor built into it: you
sign in and get a form with your own words in it — your fees, your questions, your sections — and
when you save, the site rebuilds itself and the change is live a couple of minutes later. No HTML,
nothing to install, and nothing you can break by typing in the wrong box.

Two things to know about that:

1. **You will need a GitHub account.** That is the service that stores the site's text and pictures,
   and it is what you sign in to the editor with. It is free, it takes about two minutes, and it is
   the only account involved. I will send you a short guide with pictures — including how to set the
   account up — rather than talk you through it over the phone.
2. **Every change is kept.** Nothing you do is destructive: the site remembers every version, so a
   wrong edit is undone rather than mourned.
3. **Right now your saves land on the preview, not on a live site.** That is deliberate while
   nothing is public — you can change anything you like and the only place it shows is the address
   above. When we go live we will decide whether saving publishes straight to the real site or
   whether there is a "publish" step in between. I have a view; it is a five-minute conversation
   and it depends on how much you want to be able to see a change before the world does.

**The one part that is not finished.** The site currently lives on our own server, which is fine for
looking at and not what you want to be paying for long-term. The last step is moving it to an
ordinary web host — the kind that costs a few pounds a month, or nothing — and pointing
gosscounselling.co.uk at it. That is a decision about who hosts it and what it costs, not a
technical problem, and it is worth ten minutes of the meeting. Nothing about how you edit the site
changes when it moves.

Everything else — the address, the email, the listings that point at your old hyphenated domain —
we will do in an order that means the site never goes dark.

No rush on any of this. If it is easier to say it than write it, ring or WhatsApp me whenever suits.

Best,
Ole

---

## Before sending

- [x] The URL is in — `https://gosscounselling-co-uk.stage.denfrievilje.dk`, deployed and serving
      as of run 31096292215, `noindex, nofollow` confirmed on the live page.
- [ ] Look at it on a phone yourself before sending.
- [ ] Decide whether to attach the manual (`docs/manual/`) or send it separately once it has
      screen captures in it.

## The decision behind point 3, for the meeting

Sveltia commits John's saves to the `staging` branch (`static/admin/config.yml:49`), and `staging`
deploys to the preview host. Production is the `main` branch, and **nothing merges `staging` into
`main` automatically** — today that merge is a thing one of us does by hand.

So at launch there are two shapes, and it is his call:

- **Point the editor at `main`.** He saves, the live site rebuilds, the change is public in a couple
  of minutes. Simplest to explain and the one most people expect.
- **Keep the editor on `staging` and add a publish step.** He saves, sees it on the preview address,
  and presses something when he is happy. One more concept to learn, and it means a change can sit
  unpublished because he forgot the second step.

Recommendation: the first. He is one person editing his own words, the versions are all kept, and a
wrong sentence is thirty seconds to fix. The second shape buys safety he does not need and costs a
step he will forget.
