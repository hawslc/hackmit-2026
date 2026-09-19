# HackMIT 2026

## Ideas

- Track: Education
- Challenges (maybe): ElevenLabs (use their model), Meta (human connection), Ramp (save time/money)
- App that provides real-time voice feedback for TAs practicing public speaking
  - (MVP) Public speaking: tone, pace, delivery
  - (MVP) Teaching skills: differentiates our tools from other apps → expand on what this really is
    - Using accessible language
    - Analogies/examples
    - Asking students questions that make them think + justify their thinking
    - Decomposing a concept into smaller pieces
    - Interactivity
    - Brain breaks
    - Time to process
    - (v2) Pausing between sections/ideas/questions → needs student feedback
    - Upload lecture notes / goals for the talk and use an agent to cross-reference with what was actually said to ensure all topics covered
  - (v2) Feedback on content: conciseness, clarity, flow of ideas
  - Responding to questions
- Stack: React + Node.js, with ElevenLabs, Meta, and OpenAI APIs
  - How much of {tone, pauses, pace} can audio models detect?
- (v2) Maybe look into adding video component
  - Much more AI-related input/processing

## Inputs

- PDF or file for what needs to be covered during a session (ex: lecture notes)
- Audio + transcription of the user practicing teaching
  - Have it listen + record through the frontend

## Output

- Feedback on speaking score: intonation, pacing, filler words, etc.
- List any "content gaps" where ideas in the lecture weren't covered
  - Not necessarily bad, don't need to cover everything
