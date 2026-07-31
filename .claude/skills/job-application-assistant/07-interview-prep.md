---
framework_version: 1.0.0
---

# Interview Preparation Guide

<!-- SETUP: STAR examples are personalized by running /setup based on your actual experience -->

## STAR Format

Structure answers as: **Situation** (context), **Task** (your responsibility), **Action** (what you did), **Result** (outcome).

Keep answers to 1-2 minutes. Be specific. End with what you learned or would do differently.

## Ready-Made STAR Examples

<!-- Populated by /setup from CV/LinkedIn (labeled [Source: CV/LinkedIn]) and from your own prior interview-prep notes (labeled [Source: personal notes]). Several stubs still need Result filled in - complete these before relying on them in an interview. -->

### 1. OO Structure Overhaul (Simplification & Extendibility) [Source: CV/LinkedIn - USFWS]
**S:** The USFWS tooling supporting the Endangered Species Act had accumulated an object-oriented structure that was hard to extend or simplify.
**T:** Improve the reliability and maintainability of these tools as part of ongoing modernization work.
**A:** Overhauled the OO structure to simplify it and make it easier to extend going forward.
**R:** [OUTCOME - fill in: what became easier afterward, any measurable reduction in change effort or defects]
**Use for:** "Tell me about a time you improved existing code/architecture", "How do you approach technical debt?"

### 2. Insurance Claims App Built From Scratch [Source: CV/LinkedIn - Slalom]
**S:** A client needed a way to track and streamline insurance claims and had no existing tooling for it.
**T:** As a consultant, build the application end-to-end for the client.
**A:** Built the app from the ground up on AWS, using React, Terraform, and Lambda.
**R:** [OUTCOME - fill in: adoption, time saved, client feedback]
**Use for:** "Tell me about building something from zero to one", "Describe a time you had full ownership of a project"

### 3. UI Overhaul + Agile Transformation [Source: CV/LinkedIn - Boeing 2019-2022]
**S:** An internal social network needed a full UI overhaul, and the team was not yet working in a mature Agile way.
**T:** Drive the UI overhaul with a focus on user-centricity, and help the team adopt Agile practices.
**A:** Led the UI redesign (intuitive design, integration with other Boeing apps, mobile engagement) while championing an Agile transformation that increased collective ownership, collaboration, and empathy within the team.
**R:** [OUTCOME - fill in: user engagement change, team velocity/morale change]
**Use for:** "Tell me about driving a UI/UX initiative", "Describe leading a process/culture change"

### 4. Video Infrastructure (QUMU) Team Conflict [Source: personal notes - Boeing]
**S:** Boeing was evaluating a migration to QUMU, an internal video platform offered by another team, to replace outdated video-serving infrastructure. Spikes showed QUMU was unreliable and difficult to integrate with, which split the team: developers were skeptical and favored a self-hosted alternative, while the business side wanted to stick with the earlier decision to offload the work to QUMU. People were guarded about pushing back on that earlier decision.
**T:** Foster honest communication across the team so people felt safe raising and explaining their actual reasoning, rather than staying quiet or arguing past each other.
**A:** Worked to build a team environment where disagreement could be raised openly instead of suppressed; that surfaced that the conflict wasn't really about who was technically right, it was different past experience on each side dressed up as a technical debate. Rather than keep arguing, proposed settling it with an experiment: gathered real reliability data on QUMU and built a proof-of-concept of self-hosting within a single sprint, so the team was comparing evidence instead of opinions.
**R:** The team decided not to integrate with QUMU and self-hosted instead. That system ended up outliving QUMU and became the standard the formal communications teams used for video across the internal network.
**Delivery notes:** The ownership here is in fostering the team's honest-communication environment and driving the experiment that resolved it - not in solo technical heroics. Don't dwell on the technical details of the migration itself; the trust-building and the decisive experiment are the point.
**Use for:** "Tell me about a conflict on your team", "How do you build psychological safety?", "Tell me about the hardest problem you've solved" (technical/professional judgment framing)

### 5. Long-Running UI Implementation - Keeping the Team Aligned [Source: personal notes - Boeing]
**S:** A UI implementation ran long, creating team tension over priorities and open questions about whether the investment was still worthwhile.
**T:** Bridge the gap within the team, promote harmony, and make the case that the investment was worth continuing.
**A:** Focused on honest conversation in all interactions; got the team together to reprioritize and deliver as quickly as possible; built a unified story of the transformation to communicate progress and benefits to stakeholders.
**R:** [OUTCOME - fill in: how leadership/stakeholders responded, final delivery outcome]
**Delivery notes:** Be specific about what YOU did. Keep coming back to the honesty-in-conversation thread. Be ready for "how do you prove this investment is worthwhile?"
**Use for:** "Tell me about keeping a team motivated through a long project", "Describe a time you had to justify a project's continued investment"
**Note:** This may be the same underlying project as #3 (UI overhaul) viewed from the team-dynamics angle rather than the delivery angle - consider which framing fits the question before choosing.

### 6. Balancing ITCFP Rotation Work and a Separate SOW [Source: personal notes - Boeing]
**S:** Needed to balance commitments from the High-Potential IT Career Foundation Program rotation against a separate Statement of Work.
**T:** Keep both sets of stakeholders informed and deliver on both without dropping either.
**A:** Used time blocking to protect focus time for each; presented status with a bottom-line-up-front answer, tailored for both technical and non-technical audiences.
**R:** [OUTCOME - fill in]
**Delivery notes:** Have a definite answer, bottom line up front. Stay brief describing the rotation program itself. This question is really testing communication skills.
**Use for:** "Tell me about managing competing priorities", "How do you communicate status to different audiences?"

### 7. Teaching a Technical Topic to a Mixed-Background Audience [Source: personal notes]
**S:** Needed to teach a technical topic to roughly 80 people, some technical and some non-technical.
**T:** Deliver content that landed for the whole room regardless of background.
**A:** Focused on what the audience already knew and what they specifically needed to know; used stories and memorable metaphors; checked for understanding throughout.
**R:** [OUTCOME - fill in]
**Delivery notes:** Don't get away from the actual question being asked. Tailor to what the audience already knows.
**Use for:** "Tell me about explaining something technical to a non-technical audience", "Describe a time you taught or mentored a group"

### 8. Toolchain - Finding My Own Satisfying Work [Source: personal notes - incomplete]
**S:** [INCOMPLETE - only the title was captured: "Toolchain - Needing to go find my own satisfying work"]
**T:** [TO FILL]
**A:** [TO FILL]
**R:** [TO FILL]
**Use for:** Possibly "Tell me about a time you took initiative" or motivation/autonomy questions - flesh out before using.

<!-- Add more STAR examples as needed. -->

## Ready-Made Written Answers

<!-- Full prose answers for optional application questions that ask for a short video or written summary, rather than a live interview answer. Reuse and lightly adapt per posting - don't paste verbatim if the company/framing needs to show through. -->

### "Tell us about the hardest technical or professional problem you've solved" [Built from STAR #4 - QUMU]

**Originally written for:** Boom Supersonic's optional application question - "share a link to a short video (1-2 minutes) where you walk us through the hardest technical or professional problem you've solved... We're looking for how you think and take ownership, not presentation quality."

**When to reuse:** Any application question asking for the hardest technical/professional problem solved, a time you demonstrated ownership, or a team-conflict/psychological-safety story - written summary or video-script form. Adapt the framing sentence at the end if the target company has language worth echoing (Boom's was "own a domain end-to-end" / "founder energy" / "shop floor over conference room" - pull the equivalent phrase from whatever posting you're answering).

**Length:** ~280 words, sized for a 1-2 minute spoken video or a written-summary field of similar length. Trim paragraph 1-2 further if the field has a hard word cap.

> At my role at Boeing, we were looking to migrate an outdated video serving infrastructure to a more performant system, specifically to an internal video system offered by another team. But several spikes showed that system was unreliable and difficult to integrate with.
>
> This caused a professional rift in the team between the technical side and the business side. The developers were skeptical of the quality of the resulting system if we did the integration, and were more confident that an internal implementation would be more reliable and easier to maintain. The business side was focused on an earlier decision made to offload this kind of task to this other system, so that our responsibilities and focus could move to other things.
>
> The solution boiled down to communication and rebuilding trust across the team. Rather than let the disagreement stay stuck at the surface, I worked to build a space where people felt safe sharing the why behind their position, not just insisting on the what. That surfaced the disagreement underneath: different past experience on each side, dressed up as a technical debate, not who was technically right. Once that was out in the open, I proposed we settle it with an experiment instead of continued argument: I gathered reliability data on the other team's system and built a proof-of-concept of what self-hosting would look like within a single sprint, so we'd be comparing evidence instead of opinions. With data on the table and everyone's reasoning actually heard, the team made the call not to integrate and to self-host instead. That system ended up outliving the one we'd evaluated, going on to become the standard the formal communications teams used for video across the whole internal network.

**Note:** This matches the corrected version of STAR #4 above (self-hosted, rejected QUMU) - keep both in sync if the story changes again.

<!-- Add more ready-made written answers as they're accepted for future applications. -->

## Common Tough Questions

### "Why did you leave [previous company]?"
> [PREPARE YOUR ANSWER - be honest, forward-looking, no negativity about former employer]

### "You don't have [specific skill/experience]."
> [PREPARE YOUR ANSWER - acknowledge the gap, bridge to adjacent experience, show willingness to learn]

### "Where do you see yourself in 5 years?"
> [PREPARE YOUR ANSWER - show ambition aligned with the role's growth path]

### "What's your biggest weakness?"
> [PREPARE YOUR ANSWER - genuine weakness with concrete mitigation strategy]

### "Why this company specifically?"
> Customize per company. Must reference: specific projects, company values, market position, or team structure. Never give a generic answer.

## Questions You Should Ask Interviewers

### About the Role
- "What does a typical week look like in this role?"
- "What would success look like in the first 6 months?"
- "What's the biggest challenge the team is facing right now?"

### About the Team
- "How big is the team, and how do you divide work?"
- "What does the development/project lifecycle look like, from idea to production?"
- "How do you onboard new team members?"

### About Tech & Growth
- "What's your current tech stack for [relevant area]?"
- "Is there room to grow into more architectural or strategic decisions?"
- "How does the team stay current with new tools and methods?"

### About Culture (use these to prevent disappointment)
- "How would you describe the team culture?"
- "What does professional development look like here?"
- "Is there flexibility for remote/hybrid work?"
- "What's the balance between development/new projects and maintenance work?"
- "How would you describe the leadership style in this team?"
- "What do people who thrive here have in common?"

## Phone/Video Interview Tips
- Have STAR examples written out (use this file)
- Keep a glass of water nearby
- Smile when speaking (it changes your tone)
- Ask for clarification if a question is vague
- It's OK to take 5 seconds to think before answering
- End with: "Is there anything else you'd like to know about my background?"

## After the Application (Best Practice)

### Follow-Up Etiquette
- **Don't call to "stand out"** or to learn more about the role post-submission - this risks a negative impression
- If the employer specified a timeline, respect it and wait
- If no timeline was given and significant time has passed (2+ weeks), a brief call to ask about status is acceptable
- If you have genuinely new, relevant information to share, a short follow-up is fine

### Thank-You Notes
- When you receive any update (interview invitation, rejection, or status update), send a brief thank-you message
- Express appreciation for their time and the process
- Keep it short (2-3 sentences)

## Roleplay Guidelines
When the user asks for interview practice:
1. Ask which role/company to simulate
2. Start with easy warm-up questions ("Tell me about yourself")
3. Progress to role-specific technical questions
4. Include 1-2 behavioral questions using the competencies from the job posting
5. End with a tough question or curveball
6. After each answer, give brief feedback: what worked, what to sharpen
7. Suggest which STAR example would work best for each question
