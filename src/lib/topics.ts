import type {
  LearningLevel,
  MistakeCategory,
  TopicCategory,
  VocabularyItem,
} from "./types";

export interface Topic {
  id: string;
  category: TopicCategory;
  title: string;
  /** Short brief for the local AI: what to talk about and how. */
  angle: string;
  minLevel: LearningLevel;
  /** Grammar areas this topic naturally makes the learner use. */
  practises: MistakeCategory[];
  /** Scripted questions used ONLY in Basic practice mode (no AI). */
  questions: string[];
  /** Fallback vocabulary for reports when the local AI is unavailable. */
  vocabulary: VocabularyItem[];
}

export const TOPIC_CATEGORY_LABELS: Record<TopicCategory, string> = {
  "daily-life": "Daily life",
  workplace: "Workplace conversations",
  "ai-software": "AI & software development",
  projects: "Explaining my projects",
  "opinions-stories": "Opinions & storytelling",
  interviews: "Job interviews",
  "manager-colleagues": "Managers & colleagues",
};

export const ALL_TOPIC_CATEGORIES = Object.keys(
  TOPIC_CATEGORY_LABELS,
) as TopicCategory[];

export const LEVEL_ORDER: LearningLevel[] = [
  "beginner",
  "intermediate",
  "upper-intermediate",
  "advanced",
];

export const LEVEL_LABELS: Record<LearningLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  "upper-intermediate": "Upper-intermediate",
  advanced: "Advanced",
};

export function levelRank(level: LearningLevel): number {
  return LEVEL_ORDER.indexOf(level);
}

const v = (word: string, meaning: string, example?: string): VocabularyItem => ({
  word,
  meaning,
  example,
});

export const TOPICS: Topic[] = [
  // ── Daily life ────────────────────────────────────────────────
  {
    id: "daily-last-weekend",
    category: "daily-life",
    title: "What you did last weekend",
    angle: "Chat about the learner's last weekend: where they went, who they met, what they ate. Encourage a short story in the past tense.",
    minLevel: "beginner",
    practises: ["past-tense", "verb-forms", "hindi-translation"],
    questions: [
      "What did you do last weekend?",
      "Who did you spend time with?",
      "Did you go anywhere special? What happened there?",
      "What was the best part of your weekend?",
      "Is there anything you wanted to do but couldn't?",
    ],
    vocabulary: [
      v("relax", "to rest and feel calm", "I relaxed at home on Sunday."),
      v("catch up with", "to meet someone after some time", "I caught up with an old friend."),
      v("run errands", "to do small tasks like shopping or paying bills", "I ran some errands on Saturday morning."),
      v("hang out", "to spend free time with people", "We hung out at a café."),
      v("productive", "getting a lot done", "It was a productive weekend."),
    ],
  },
  {
    id: "daily-routine",
    category: "daily-life",
    title: "Your daily routine",
    angle: "Talk about the learner's typical weekday: morning, work or study, evening. Ask about habits and what they would like to change.",
    minLevel: "beginner",
    practises: ["subject-verb-agreement", "hindi-translation", "prepositions"],
    questions: [
      "Can you describe a normal weekday for you, from morning to night?",
      "What is the first thing you do after you wake up?",
      "How do you usually travel to work or college?",
      "What do you do in the evening to relax?",
      "Which habit in your routine would you like to change, and why?",
    ],
    vocabulary: [
      v("commute", "the journey to work or college", "My commute takes forty minutes."),
      v("routine", "the things you do regularly", "I follow a fixed morning routine."),
      v("unwind", "to relax after work", "I unwind by listening to music."),
      v("on weekdays", "Monday to Friday", "On weekdays I get up at seven."),
      v("stick to", "to continue doing something as planned", "I try to stick to my schedule."),
    ],
  },
  {
    id: "daily-food",
    category: "daily-life",
    title: "Food and cooking",
    angle: "Talk about favourite food, home cooking, eating out, and a dish the learner can explain step by step.",
    minLevel: "beginner",
    practises: ["articles", "uncountable-nouns", "comparatives"],
    questions: [
      "What is your favourite dish, and why do you like it?",
      "Can you cook? Tell me how you make one simple dish.",
      "Do you prefer home food or eating out? Why?",
      "What did you eat yesterday?",
      "Which city or place has the best food, in your opinion?",
    ],
    vocabulary: [
      v("spicy", "having a strong hot taste", "I like spicy food."),
      v("ingredients", "the things used to make a dish", "The ingredients are simple."),
      v("homemade", "made at home", "Nothing beats homemade food."),
      v("crave", "to want something strongly", "I'm craving biryani."),
      v("a balanced diet", "healthy mix of food", "I try to eat a balanced diet."),
    ],
  },
  {
    id: "daily-hometown",
    category: "daily-life",
    title: "Your hometown",
    angle: "Talk about where the learner grew up, how it has changed, and what they miss about it.",
    minLevel: "beginner",
    practises: ["present-perfect", "past-tense", "comparatives"],
    questions: [
      "Where is your hometown, and what is it famous for?",
      "How has your hometown changed in the last few years?",
      "What do you miss most about it?",
      "If a friend visits your hometown, where should they go?",
      "Would you like to live there again in the future? Why or why not?",
    ],
    vocabulary: [
      v("grow up", "to spend your childhood somewhere", "I grew up in a small town."),
      v("crowded", "full of people", "The market is always crowded."),
      v("peaceful", "quiet and calm", "Mornings there are very peaceful."),
      v("nostalgic", "happily remembering the past", "I feel nostalgic when I visit."),
      v("develop", "to grow and improve", "The town has developed a lot."),
    ],
  },
  {
    id: "daily-health",
    category: "daily-life",
    title: "Health and fitness habits",
    angle: "Talk about exercise, sleep, screen time and small healthy habits. Ask what they have tried recently.",
    minLevel: "intermediate",
    practises: ["present-perfect", "stative-verbs", "uncountable-nouns"],
    questions: [
      "What do you do to stay healthy?",
      "Have you started any new habit recently?",
      "How many hours do you usually sleep? Is it enough?",
      "Do you think people spend too much time on their phones?",
      "What advice would you give to someone who sits at a desk all day?",
    ],
    vocabulary: [
      v("work out", "to exercise", "I work out three times a week."),
      v("screen time", "time spent looking at screens", "I'm trying to reduce my screen time."),
      v("consistent", "doing something regularly", "Being consistent is the hardest part."),
      v("burnout", "extreme tiredness from too much work", "Long hours can lead to burnout."),
      v("a piece of advice", "one suggestion", "Here is a piece of advice."),
    ],
  },

  // ── Workplace ─────────────────────────────────────────────────
  {
    id: "work-typical-day",
    category: "workplace",
    title: "A typical day at work",
    angle: "Talk about the learner's job or studies: tasks, meetings, tools, and what a busy day looks like.",
    minLevel: "beginner",
    practises: ["present-perfect", "subject-verb-agreement", "articles"],
    questions: [
      "What do you do at work, and how long have you been doing it?",
      "What does a busy day at work look like for you?",
      "Which part of your work do you enjoy the most?",
      "What tools or software do you use every day?",
      "What was the last problem you solved at work?",
    ],
    vocabulary: [
      v("deadline", "the time by which work must be finished", "We have a tight deadline."),
      v("prioritise", "to decide what is most important", "I prioritise tasks every morning."),
      v("stand-up meeting", "a short daily team meeting", "Our stand-up starts at ten."),
      v("workload", "the amount of work", "My workload is heavy this week."),
      v("responsible for", "having the duty to do something", "I am responsible for testing."),
    ],
  },
  {
    id: "work-meeting-update",
    category: "workplace",
    title: "Giving a status update in a meeting",
    angle: "Role-play a team stand-up: the learner explains what they finished, what they are doing, and any blockers. Ask natural follow-ups.",
    minLevel: "intermediate",
    practises: ["present-perfect", "past-tense", "redundant-words"],
    questions: [
      "Let's practise a stand-up. What did you finish yesterday?",
      "What are you working on today?",
      "Is anything blocking your work right now?",
      "How long will it take to finish your current task?",
      "What help do you need from your team?",
    ],
    vocabulary: [
      v("blocker", "something that stops progress", "My only blocker is the API access."),
      v("on track", "progressing as planned", "The feature is on track for Friday."),
      v("wrap up", "to finish", "I'll wrap up the testing today."),
      v("follow up", "to check on something later", "I'll follow up with the design team."),
      v("ETA", "expected time of completion", "The ETA for the fix is tomorrow."),
    ],
  },
  {
    id: "work-email-call",
    category: "workplace",
    title: "Handling a difficult work situation",
    angle: "Talk about a time something went wrong at work (a bug, a missed deadline, a misunderstanding) and how the learner handled it.",
    minLevel: "intermediate",
    practises: ["past-tense", "verb-forms", "word-choice"],
    questions: [
      "Tell me about a time something went wrong at work or in college.",
      "What did you do first when you noticed the problem?",
      "How did you explain the situation to others?",
      "What did you learn from it?",
      "What would you do differently next time?",
    ],
    vocabulary: [
      v("escalate", "to pass a problem to someone more senior", "I escalated the issue to my lead."),
      v("take ownership", "to accept responsibility", "I took ownership of the bug."),
      v("root cause", "the main reason for a problem", "We found the root cause quickly."),
      v("misunderstanding", "when people understand something differently", "It was just a misunderstanding."),
      v("lesson learned", "something useful learned from a mistake", "The lesson learned was to test earlier."),
    ],
  },
  {
    id: "work-goals",
    category: "workplace",
    title: "Career goals",
    angle: "Discuss where the learner wants to be in a few years, the skills they need, and the steps they are taking now.",
    minLevel: "intermediate",
    practises: ["present-perfect", "verb-forms", "word-order"],
    questions: [
      "Where do you see yourself in three years?",
      "Which skills do you want to improve, and why?",
      "What have you done this year to grow in your career?",
      "Who inspires you in your field?",
      "What is one small step you can take this month?",
    ],
    vocabulary: [
      v("upskill", "to learn new skills for work", "I'm upskilling in cloud computing."),
      v("long-term", "over a long period", "My long-term goal is to lead a team."),
      v("career growth", "progress in your job", "I want steady career growth."),
      v("mentor", "an experienced person who guides you", "My mentor helped me a lot."),
      v("set a goal", "to decide what you want to achieve", "I set a goal for every quarter."),
    ],
  },

  // ── AI & software development ─────────────────────────────────
  {
    id: "ai-tools-daily",
    category: "ai-software",
    title: "How you use AI tools",
    angle: "Talk about which AI tools the learner uses (coding assistants, chatbots), what works well, and what worries them.",
    minLevel: "intermediate",
    practises: ["present-perfect", "uncountable-nouns", "articles"],
    questions: [
      "Which AI tools do you use, and for what?",
      "How has AI changed the way you work or study?",
      "Can you share one time an AI tool really helped you?",
      "What are the risks of depending too much on AI?",
      "Do you think AI will replace some jobs? Which ones?",
    ],
    vocabulary: [
      v("automate", "to make a task happen without manual work", "I automated the report generation."),
      v("accuracy", "how correct something is", "The accuracy is not always good."),
      v("rely on", "to depend on", "I don't rely on AI for everything."),
      v("hallucinate", "(of AI) to produce false information confidently", "The model sometimes hallucinates."),
      v("productivity", "how much work you get done", "AI improved my productivity."),
    ],
  },
  {
    id: "ai-explain-concept",
    category: "ai-software",
    title: "Explaining a technical concept simply",
    angle: "Ask the learner to explain a technical concept they know (an API, a database, machine learning, Git) to a non-technical person. Ask clarifying questions like a curious beginner.",
    minLevel: "intermediate",
    practises: ["articles", "subject-verb-agreement", "word-choice"],
    questions: [
      "Pick a technical concept you know well. How would you explain it to a child?",
      "Why is that concept useful in real projects?",
      "Can you give a simple everyday example of it?",
      "What mistake do beginners usually make with it?",
      "How did you learn it yourself?",
    ],
    vocabulary: [
      v("in simple terms", "explained in an easy way", "In simple terms, an API is a messenger."),
      v("analogy", "a comparison that helps explain something", "Let me use an analogy."),
      v("under the hood", "how something works internally", "Under the hood, it uses a database."),
      v("for instance", "for example", "For instance, a login form calls an API."),
      v("in a nutshell", "in summary", "In a nutshell, it saves time."),
    ],
  },
  {
    id: "ai-future-of-dev",
    category: "ai-software",
    title: "The future of software development",
    angle: "Discuss how software development might change in five years: AI pair programmers, new roles, what skills will matter.",
    minLevel: "upper-intermediate",
    practises: ["verb-forms", "comparatives", "word-order"],
    questions: [
      "How do you think software development will change in five years?",
      "Which skills will matter more for developers in the future?",
      "Should junior developers worry about AI? Why?",
      "What do humans do better than AI in software projects?",
      "How are you preparing yourself for these changes?",
    ],
    vocabulary: [
      v("adapt", "to change to suit new conditions", "Developers must adapt quickly."),
      v("obsolete", "no longer used", "Some tools will become obsolete."),
      v("critical thinking", "careful, logical thinking", "Critical thinking will still matter."),
      v("emerging", "new and growing", "There are many emerging roles."),
      v("in the long run", "over a long time", "In the long run, it helps everyone."),
    ],
  },
  {
    id: "ai-debugging-story",
    category: "ai-software",
    title: "Your toughest bug",
    angle: "Ask the learner to tell the story of the hardest bug or technical problem they fixed: symptoms, investigation, fix.",
    minLevel: "intermediate",
    practises: ["past-tense", "verb-forms", "redundant-words"],
    questions: [
      "What is the toughest bug you have ever fixed?",
      "How did you first notice the problem?",
      "What steps did you take to find the cause?",
      "How did you finally fix it?",
      "What did you learn from that experience?",
    ],
    vocabulary: [
      v("reproduce", "to make a bug happen again", "I couldn't reproduce the bug at first."),
      v("investigate", "to examine carefully", "I investigated the logs."),
      v("workaround", "a temporary solution", "We used a workaround for a week."),
      v("edge case", "an unusual situation", "It was an edge case with empty input."),
      v("figure out", "to understand or solve", "Finally, I figured it out."),
    ],
  },

  // ── Explaining projects ───────────────────────────────────────
  {
    id: "project-overview",
    category: "projects",
    title: "Explain one of your projects",
    angle: "Ask the learner to explain a personal or work project: the problem, who it helps, the tech stack, and their role. Ask follow-ups like an interested colleague.",
    minLevel: "beginner",
    practises: ["present-perfect", "articles", "redundant-words"],
    questions: [
      "Tell me about a project you are proud of. What does it do?",
      "What problem does it solve, and for whom?",
      "Which technologies did you use, and why?",
      "What was your role in the project?",
      "What would you improve if you had more time?",
    ],
    vocabulary: [
      v("built with", "made using", "It's built with React and Node."),
      v("the main goal", "the most important aim", "The main goal is to save time."),
      v("end user", "the person who finally uses a product", "The end users are farmers."),
      v("feature", "a function of a product", "The key feature is voice search."),
      v("scalable", "able to grow easily", "We made the backend scalable."),
    ],
  },
  {
    id: "project-challenges",
    category: "projects",
    title: "Challenges in your project",
    angle: "Discuss the biggest challenge in one of the learner's projects, the decisions they made, and the trade-offs.",
    minLevel: "intermediate",
    practises: ["past-tense", "verb-forms", "word-choice"],
    questions: [
      "What was the biggest challenge in your last project?",
      "Why was it difficult?",
      "What options did you consider?",
      "Which decision are you most happy about?",
      "If you started again, what would you change?",
    ],
    vocabulary: [
      v("trade-off", "giving up one thing to gain another", "There was a trade-off between speed and cost."),
      v("constraint", "a limit", "Our main constraint was time."),
      v("overcome", "to deal with a difficulty successfully", "We overcame the issue by caching data."),
      v("iterate", "to improve step by step", "We iterated on the design three times."),
      v("feedback", "comments about how good something is", "User feedback was very helpful."),
    ],
  },
  {
    id: "project-demo",
    category: "projects",
    title: "Demo your project to a client",
    angle: "Role-play: the coach is a potential client. The learner presents their project and answers simple business questions.",
    minLevel: "upper-intermediate",
    practises: ["question-form", "articles", "word-choice"],
    questions: [
      "Imagine I'm a client. Can you introduce your product in one minute?",
      "Why should I choose your product over others?",
      "How much time will it save my team?",
      "What happens if something goes wrong?",
      "What are the next features you plan to build?",
    ],
    vocabulary: [
      v("value proposition", "the main benefit a product offers", "Our value proposition is speed."),
      v("seamless", "smooth, without problems", "The setup is seamless."),
      v("customise", "to change to suit needs", "You can customise the dashboard."),
      v("roadmap", "a plan of future work", "It's on our roadmap for next quarter."),
      v("reliable", "can be trusted to work", "The system is very reliable."),
    ],
  },

  // ── Opinions & storytelling ───────────────────────────────────
  {
    id: "story-memorable-trip",
    category: "opinions-stories",
    title: "A memorable trip",
    angle: "Ask the learner to tell the story of a memorable trip: where, who, what happened, how they felt.",
    minLevel: "beginner",
    practises: ["past-tense", "verb-forms", "hindi-translation"],
    questions: [
      "Tell me about a trip you will never forget.",
      "Who did you go with, and how did you travel?",
      "What was the most surprising thing that happened?",
      "Did anything go wrong on the trip?",
      "Would you go back there? Why?",
    ],
    vocabulary: [
      v("breathtaking", "extremely beautiful", "The view was breathtaking."),
      v("itinerary", "a travel plan", "We didn't follow the itinerary."),
      v("unexpected", "surprising", "We had an unexpected adventure."),
      v("set off", "to start a journey", "We set off early in the morning."),
      v("memorable", "worth remembering", "It was a memorable trip."),
    ],
  },
  {
    id: "opinion-online-learning",
    category: "opinions-stories",
    title: "Online vs classroom learning",
    angle: "Discuss the learner's opinion on online learning compared with classrooms. Ask them to give reasons and examples.",
    minLevel: "intermediate",
    practises: ["comparatives", "subject-verb-agreement", "word-order"],
    questions: [
      "Do you prefer online learning or classroom learning? Why?",
      "What is one big advantage of online courses?",
      "What do students miss when they learn only online?",
      "Which online course helped you the most?",
      "How should colleges change in the future?",
    ],
    vocabulary: [
      v("flexible", "easy to change to suit your needs", "Online courses are flexible."),
      v("self-paced", "you decide how fast to go", "I like self-paced learning."),
      v("distraction", "something that takes your attention away", "Phones are a big distraction."),
      v("interaction", "communication between people", "Classrooms have more interaction."),
      v("on the other hand", "used to show a different point", "On the other hand, it's cheaper."),
    ],
  },
  {
    id: "opinion-social-media",
    category: "opinions-stories",
    title: "Social media: good or bad?",
    angle: "Discuss social media's effect on young people and professionals. Encourage the learner to agree/disagree politely and give examples.",
    minLevel: "intermediate",
    practises: ["stative-verbs", "subject-verb-agreement", "uncountable-nouns"],
    questions: [
      "Do you think social media does more good or more harm? Why?",
      "Which social media app do you use most, and for what?",
      "Has social media ever helped your career?",
      "Should children use social media? At what age?",
      "How can people use social media in a healthier way?",
    ],
    vocabulary: [
      v("I'd argue that", "a polite way to give an opinion", "I'd argue that it helps networking."),
      v("addictive", "hard to stop using", "Short videos are addictive."),
      v("misinformation", "false information", "Misinformation spreads fast."),
      v("networking", "making professional contacts", "LinkedIn is great for networking."),
      v("in moderation", "not too much", "It's fine in moderation."),
    ],
  },
  {
    id: "story-childhood",
    category: "opinions-stories",
    title: "A childhood memory",
    angle: "Ask about a happy or funny childhood memory; encourage descriptive past-tense storytelling with feelings.",
    minLevel: "beginner",
    practises: ["past-tense", "verb-forms", "pronouns"],
    questions: [
      "What is one of your happiest childhood memories?",
      "Who was with you at that time?",
      "What games did you play as a child?",
      "Which teacher do you remember the most, and why?",
      "How were you different as a child compared to now?",
    ],
    vocabulary: [
      v("used to", "something you did regularly in the past", "We used to play cricket every evening."),
      v("mischievous", "playfully naughty", "I was quite mischievous."),
      v("vividly", "very clearly", "I remember it vividly."),
      v("cherish", "to value and love", "I cherish those days."),
      v("look back", "to think about the past", "When I look back, I smile."),
    ],
  },

  // ── Job interviews ────────────────────────────────────────────
  {
    id: "interview-introduce",
    category: "interviews",
    title: "Interview: Tell me about yourself",
    angle: "Role-play an interviewer for a software/tech role. Start with 'Tell me about yourself' and ask natural follow-ups about education, experience and skills. Be friendly but realistic.",
    minLevel: "beginner",
    practises: ["present-perfect", "hindi-translation", "articles", "stative-verbs"],
    questions: [
      "Let's start the interview. Tell me about yourself.",
      "What are you doing currently, and how long have you been doing it?",
      "Which skills make you a good fit for this role?",
      "What is one achievement you are proud of?",
      "Why are you looking for a new opportunity?",
    ],
    vocabulary: [
      v("background", "your education and experience", "I have a background in computer science."),
      v("hands-on experience", "practical experience", "I have hands-on experience with React."),
      v("passionate about", "very interested in", "I'm passionate about building useful products."),
      v("currently", "at the moment", "I'm currently working as a developer."),
      v("a good fit", "suitable", "I believe I'm a good fit for this role."),
    ],
  },
  {
    id: "interview-strengths",
    category: "interviews",
    title: "Interview: strengths and weaknesses",
    angle: "Role-play an interviewer asking about strengths, weaknesses and examples. Push gently for specific examples (STAR style).",
    minLevel: "intermediate",
    practises: ["past-tense", "stative-verbs", "word-choice"],
    questions: [
      "What is your greatest strength? Can you give an example?",
      "What is one weakness you are working on?",
      "Tell me about a time you worked under pressure.",
      "How do your colleagues describe you?",
      "What did you learn from your last mistake at work?",
    ],
    vocabulary: [
      v("detail-oriented", "careful about small details", "I'm detail-oriented when testing."),
      v("under pressure", "with stress and little time", "I stay calm under pressure."),
      v("work on", "to try to improve", "I'm working on my public speaking."),
      v("for example", "used before an example", "For example, last month I led a release."),
      v("as a result", "because of that", "As a result, we delivered on time."),
    ],
  },
  {
    id: "interview-behavioral",
    category: "interviews",
    title: "Interview: teamwork and conflict",
    angle: "Role-play a behavioural interview: teamwork, disagreement with a colleague, handling feedback. Ask for situation, action, result.",
    minLevel: "upper-intermediate",
    practises: ["past-tense", "verb-forms", "prepositions"],
    questions: [
      "Tell me about a time you disagreed with a teammate. What happened?",
      "How did you resolve the situation?",
      "Describe a time you received difficult feedback.",
      "How do you handle a teammate who is not doing their work?",
      "What makes a team successful, in your opinion?",
    ],
    vocabulary: [
      v("resolve", "to find a solution", "We resolved it through a quick call."),
      v("compromise", "an agreement where both sides give a little", "We reached a compromise."),
      v("constructive", "helpful, meant to improve", "The feedback was constructive."),
      v("collaborate", "to work together", "I collaborate closely with designers."),
      v("perspective", "a point of view", "I tried to understand his perspective."),
    ],
  },
  {
    id: "interview-why-company",
    category: "interviews",
    title: "Interview: why this company?",
    angle: "Role-play an HR interviewer: why this company, salary expectations, notice period, questions for the interviewer. Keep it realistic and polite.",
    minLevel: "intermediate",
    practises: ["question-form", "hindi-translation", "redundant-words"],
    questions: [
      "Why do you want to join our company?",
      "What do you know about our work?",
      "What are your expectations from this role?",
      "When can you join if we make an offer?",
      "Do you have any questions for me?",
    ],
    vocabulary: [
      v("align with", "to match", "Your values align with mine."),
      v("notice period", "time you must work after resigning", "My notice period is thirty days."),
      v("growth opportunities", "chances to develop", "I'm looking for growth opportunities."),
      v("contribute", "to give something useful", "I can contribute from day one."),
      v("culture", "the way people work and behave in a company", "I like your engineering culture."),
    ],
  },

  // ── Managers & colleagues ─────────────────────────────────────
  {
    id: "colleague-asking-help",
    category: "manager-colleagues",
    title: "Asking a colleague for help",
    angle: "Role-play: the learner needs help from a senior colleague (code review, access, explanation). Practise polite requests and clarifying questions.",
    minLevel: "beginner",
    practises: ["question-form", "prepositions", "hindi-translation"],
    questions: [
      "Imagine you are stuck on a task. How would you ask a senior colleague for help?",
      "How do you explain what you have already tried?",
      "What if they are busy? What would you say?",
      "How do you thank someone for their help at work?",
      "When did a colleague last help you, and how?",
    ],
    vocabulary: [
      v("Could you please…", "a polite request", "Could you please review my code?"),
      v("whenever you're free", "at a convenient time", "Can we talk whenever you're free?"),
      v("walk me through", "explain step by step", "Could you walk me through the setup?"),
      v("I really appreciate it", "thank you very much", "Thanks for the help, I really appreciate it."),
      v("quick question", "a short question", "I have a quick question about the API."),
    ],
  },
  {
    id: "manager-leave-request",
    category: "manager-colleagues",
    title: "Talking to your manager",
    angle: "Role-play conversations with a manager: asking for leave, explaining a delay, or asking for a new responsibility. The coach plays the manager.",
    minLevel: "intermediate",
    practises: ["verb-forms", "present-perfect", "hindi-translation"],
    questions: [
      "Imagine you need two days of leave next week. How would you ask your manager?",
      "Your task is delayed. How do you explain it to your manager?",
      "How would you ask for more responsibility?",
      "How do you disagree with your manager politely?",
      "What makes a manager easy to work with?",
    ],
    vocabulary: [
      v("I was wondering if…", "a polite way to ask", "I was wondering if I could take Friday off."),
      v("heads-up", "an early warning", "Just a heads-up, the release may slip."),
      v("revised timeline", "a changed schedule", "Here's the revised timeline."),
      v("take on", "to accept a new task", "I'd like to take on more backend work."),
      v("respectfully", "politely", "Respectfully, I see it differently."),
    ],
  },
  {
    id: "colleague-small-talk",
    category: "manager-colleagues",
    title: "Small talk with colleagues",
    angle: "Practise office small talk: weekend plans, weather, lunch, festivals. Keep it light and natural, with short back-and-forth.",
    minLevel: "beginner",
    practises: ["question-form", "past-tense", "hindi-translation"],
    questions: [
      "It's Monday morning. How would you start a chat with a colleague?",
      "Any plans for the coming festival or holiday?",
      "Where do you usually have lunch at work?",
      "What do you and your colleagues talk about outside work?",
      "How do you end a small conversation politely?",
    ],
    vocabulary: [
      v("How was your weekend?", "a common opening question", "Hey, how was your weekend?"),
      v("grab lunch", "to eat lunch quickly together", "Want to grab lunch?"),
      v("catch you later", "an informal goodbye", "Okay, catch you later!"),
      v("by the way", "used to add a new point", "By the way, nice presentation."),
      v("looking forward to", "excited about something in the future", "I'm looking forward to the trip."),
    ],
  },
];

export function getTopic(id: string): Topic | undefined {
  return TOPICS.find((t) => t.id === id);
}

/** Generic, clearly-scripted follow-ups for Basic practice mode. */
export const BASIC_FOLLOW_UPS: string[] = [
  "Can you tell me a little more about that?",
  "Why do you think so?",
  "Can you give me an example?",
  "How did you feel about it?",
  "What happened after that?",
];
