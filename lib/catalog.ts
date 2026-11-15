import type { GoalTemplate, Level, TaskChallenge } from './types';

/** Authored practice material. Answer keys belong to the server response builder only. */
export type FullQuestion = NonNullable<TaskChallenge['questions']>[number] & {
  answer: number;
  explanation: string;
};
export type FullTaskChallenge = Omit<TaskChallenge, 'questions'> & {
  questions?: FullQuestion[];
};

const quizLevels: GoalTemplate['levels'] = {
  light: { label: 'Light', description: '1 practice question each day', points: 10 },
  standard: { label: 'Standard', description: '2 practice questions each day', points: 20 },
  stretch: { label: 'Stretch', description: '3 practice questions each day', points: 30 },
};
const writingLevels: GoalTemplate['levels'] = {
  light: { label: 'Light', description: 'Write at least 50 words each day', points: 10 },
  standard: { label: 'Standard', description: 'Write at least 100 words each day', points: 20 },
  stretch: { label: 'Stretch', description: 'Write at least 200 words each day', points: 30 },
};

export const TEMPLATES: GoalTemplate[] = [
  {
    id: 'spanish-daily',
    title: 'A little Spanish, every day',
    category: 'Languages', icon: 'Languages', color: '#8870DF',
    description: 'Build a daily practice habit with short beginner Spanish questions and clear feedback.',
    verification: 'quiz', levels: quizLevels,
  },
  {
    id: 'javascript-daily',
    title: 'Keep your JavaScript sharp',
    category: 'Coding', icon: 'Code2', color: '#5C83D9',
    description: 'Read small pieces of JavaScript, predict the result, and check your understanding.',
    verification: 'quiz', levels: quizLevels,
  },
  {
    id: 'critical-thinking',
    title: 'Think a little clearer',
    category: 'Focus', icon: 'Brain', color: '#CC934A',
    description: 'Practice spotting assumptions, reading evidence, and separating conclusions from guesses.',
    verification: 'quiz', levels: quizLevels,
  },
  {
    id: 'writing-daily',
    title: 'Find your writing rhythm',
    category: 'Writing', icon: 'PenLine', color: '#C8759A',
    description: 'Turn a fresh daily prompt into a short piece of writing. Submissions are checked for length, not graded for quality.',
    verification: 'writing', levels: writingLevels,
  },
  {
    id: 'clear-communication',
    title: 'Make your message land',
    category: 'Writing', icon: 'MessageSquare', color: '#4A9B8A',
    description: 'Rehearse clear explanations, useful feedback, and thoughtful requests with everyday scenarios.',
    verification: 'writing', levels: writingLevels,
  },
  {
    id: 'interview-stories',
    title: 'Build your interview stories',
    category: 'Career', icon: 'Briefcase', color: '#8B7CC5',
    description: 'Practice describing your own experience with a focused daily interview prompt.',
    verification: 'writing', levels: writingLevels,
  },
  {
    id: 'focused-practice',
    title: 'Show up for focused practice',
    category: 'Focus', icon: 'Target', color: '#70A071',
    description: 'Protect one distraction-free practice session for a skill you care about. Completion is self-reported.',
    verification: 'self',
    levels: {
      light: { label: 'Light', description: 'One 5-minute practice session', points: 10 },
      standard: { label: 'Standard', description: 'One 15-minute practice session', points: 20 },
      stretch: { label: 'Stretch', description: 'One 25-minute practice session', points: 30 },
    },
  },
];

type QuestionInput = [question: string, options: string[], answer: number, explanation: string];
type Pack = { title: string; questions: QuestionInput[] };

const SPANISH: Pack[] = [
  {
    title: 'Start a conversation',
    questions: [
      ['Which phrase means “good morning”?', ['Buenas noches', 'Buenos días', 'Hasta luego'], 1, 'Buenos días is the usual greeting for good morning.'],
      ['Which phrase means “please”?', ['Por favor', 'De nada', 'Lo siento'], 0, 'Por favor means please; de nada means you are welcome.'],
      ['Which word means “thank you”?', ['Hola', 'Adiós', 'Gracias'], 2, 'Gracias means thank you.'],
    ],
  },
  {
    title: 'Talk about people',
    questions: [
      ['Complete the sentence: “Yo ___ estudiante.”', ['soy', 'eres', 'son'], 0, 'Soy is the first-person singular form of ser: yo soy.'],
      ['Which subject pronoun means the informal singular “you”?', ['nosotros', 'tú', 'ellos'], 1, 'Tú is the informal singular subject pronoun for you.'],
      ['What does “nosotros” mean?', ['they', 'he', 'we'], 2, 'Nosotros means we.'],
    ],
  },
  {
    title: 'Notice everyday words',
    questions: [
      ['What does “el libro” mean?', ['the book', 'the table', 'the window'], 0, 'Libro is the Spanish word for book.'],
      ['Which word means “house”?', ['calle', 'casa', 'mesa'], 1, 'Casa means house; calle means street and mesa means table.'],
      ['What does “agua” mean?', ['bread', 'coffee', 'water'], 2, 'Agua means water.'],
    ],
  },
  {
    title: 'Count small wins',
    questions: [
      ['Which number is “cinco”?', ['3', '5', '8'], 1, 'Cinco means five.'],
      ['How do you say “eight” in Spanish?', ['ocho', 'seis', 'diez'], 0, 'Ocho means eight.'],
      ['What is “tres más dos”?', ['cuatro', 'seis', 'cinco'], 2, 'Tres más dos means three plus two, which is five: cinco.'],
    ],
  },
  {
    title: 'At a café',
    questions: [
      ['What does “Quisiera un café” mean?', ['I would like a coffee', 'The coffee is cold', 'I do not drink coffee'], 0, 'Quisiera is a polite way to say I would like.'],
      ['Which question asks “How much does it cost?”', ['¿Dónde está?', '¿Cuánto cuesta?', '¿Cómo te llamas?'], 1, '¿Cuánto cuesta? asks the price.'],
      ['What does “La cuenta, por favor” request?', ['the menu', 'a glass of water', 'the bill, please'], 2, 'La cuenta is the bill or check in a café or restaurant.'],
    ],
  },
  {
    title: 'Plan your week',
    questions: [
      ['Which day is “lunes”?', ['Monday', 'Friday', 'Sunday'], 0, 'Lunes means Monday.'],
      ['Which Spanish word means “today”?', ['ayer', 'hoy', 'nunca'], 1, 'Hoy means today; ayer means yesterday and nunca means never.'],
      ['Which word means “week”?', ['hora', 'mes', 'semana'], 2, 'Semana means week.'],
    ],
  },
  {
    title: 'Say one more thing',
    questions: [
      ['What does “Me gusta leer” mean?', ['I like to read', 'I need a book', 'I cannot read'], 0, 'Me gusta leer means I like to read.'],
      ['What does “Tengo dos perros” mean?', ['I see two dogs', 'I have two dogs', 'I want two dogs'], 1, 'Tengo means I have, dos means two, and perros means dogs.'],
      ['What does “No entiendo” mean?', ['I am not here', 'I do not remember', 'I do not understand'], 2, 'No entiendo means I do not understand.'],
    ],
  },
];

const JAVASCRIPT: Pack[] = [
  {
    title: 'Values and types',
    questions: [
      ['What does typeof "42" return?', ['"number"', '"string"', '"boolean"'], 1, 'Quotes make "42" a string, so typeof returns "string".'],
      ['What is the result of 3 === "3"?', ['false', 'true', 'undefined'], 0, 'Strict equality does not convert types. A number and a string are different.'],
      ['Given const items = ["a", "b"], what is items[0]?', ['"b"', 'undefined', '"a"'], 2, 'JavaScript arrays use zero-based indexing, so index 0 is the first item.'],
    ],
  },
  {
    title: 'Work with arrays',
    questions: [
      ['What does [1, 2].map(n => n * 2) return?', ['[2, 4]', '[1, 2, 2]', '3'], 0, 'map creates a new array containing the result for each input element.'],
      ['What does [1, 3, 5].filter(n => n > 2) return?', ['[1]', '[3, 5]', '[true, true]'], 1, 'filter keeps the elements for which the condition is true: 3 and 5.'],
      ['What is ["red", "green", "blue"].length?', ['2', '4', '3'], 2, 'The array contains three elements.'],
    ],
  },
  {
    title: 'Functions and bindings',
    questions: [
      ['What does this return: function double(x) { return x * 2; } double(4)?', ['8', '4', 'undefined'], 0, 'The function returns its input multiplied by two, so double(4) is 8.'],
      ['Which declaration allows you to reassign the variable later?', ['const', 'let', 'Both are identical'], 1, 'A let binding can be reassigned. A const binding cannot be reassigned.'],
      ['What is add(2, 3) when const add = (a, b) => a + b?', ['"23"', 'undefined', '5'], 2, 'Both inputs are numbers, so the + operation adds them to produce 5.'],
    ],
  },
  {
    title: 'Choose a fallback',
    questions: [
      ['What does Boolean("") return?', ['false', 'true', 'null'], 0, 'The empty string is a falsy value.'],
      ['What is null ?? "fallback"?', ['null', '"fallback"', 'false'], 1, 'The nullish coalescing operator uses the right value when the left value is null or undefined.'],
      ['What is 0 || 7?', ['0', 'true', '7'], 2, 'The || operator returns the right operand when the left operand is falsy. Zero is falsy.'],
    ],
  },
  {
    title: 'Read objects',
    questions: [
      ['Given const person = { name: "Ari" }, what is person.name?', ['"Ari"', '"name"', 'undefined'], 0, 'Dot notation reads the value stored under that property name.'],
      ['Given const { score } = { score: 12 }, what is score?', ['"score"', '12', '{ score: 12 }'], 1, 'Object destructuring creates a binding from the matching property value.'],
      ['What is the value of result.a after const result = { ...{ a: 1 }, a: 2 }?', ['1', 'undefined', '2'], 2, 'The later a: 2 property overrides the earlier a: 1 value.'],
    ],
  },
  {
    title: 'Handle data and async work',
    questions: [
      ['Inside an async function, which keyword waits for a promise to settle?', ['await', 'yield', 'defer'], 0, 'await pauses that async function until the promise fulfills or rejects.'],
      ['What is JSON.parse("{\"done\":true}").done?', ['"true"', 'true', 'undefined'], 1, 'JSON.parse creates an object whose done property is the boolean true.'],
      ['What does Number("12") return?', ['"12"', 'NaN', '12'], 2, 'The numeric string "12" converts to the number 12.'],
    ],
  },
  {
    title: 'Keep code predictable',
    questions: [
      ['Which loop reads the values of an array?', ['for...of', 'for...in', 'for...keys'], 0, 'for...of iterates over values. for...in iterates over enumerable property names.'],
      ['Which block handles an error thrown inside its matching try block?', ['finally', 'catch', 'else'], 1, 'A catch block handles an exception thrown during the matching try block.'],
      ['Which array method returns a new array without changing the original array itself?', ['push', 'pop', 'map'], 2, 'map returns a new array; push and pop change the original array.'],
    ],
  },
];

const THINKING: Pack[] = [
  {
    title: 'Separate a pattern from a cause',
    questions: [
      ['People who attend more workshops also report higher confidence. What can this observation alone establish?', ['Workshop attendance causes confidence', 'Attendance and confidence are associated in this sample', 'Confident people never skip workshops'], 1, 'An association alone cannot establish which factor caused the other or rule out other explanations.'],
      ['A café changes its menu and its prices on the same day. Sales rise. Why is the effect of the new menu uncertain?', ['Two things changed at once', 'Sales cannot be measured', 'A price change has no effect'], 0, 'Changing two factors at once makes it difficult to attribute the result to either one alone.'],
      ['Which evidence would help test whether a reminder improves completion?', ['A single enthusiastic comment', 'The reminder uses a bright color', 'Compare completion in similar groups with and without the reminder'], 2, 'A comparison with a suitable control group gives more useful evidence about the reminder.'],
    ],
  },
  {
    title: 'Check the denominator',
    questions: [
      ['A task was completed by 12 of 40 participants. What is the completion rate?', ['30%', '12%', '40%'], 0, '12 divided by 40 is 0.30, or 30%.'],
      ['Two teams report 20 completions each. What else do you need to compare their completion rates?', ['Their team names', 'How many participants each team had', 'The color of their dashboards'], 1, 'A rate needs both the number of completions and the number of eligible participants.'],
      ['A rate rises from 20% to 30%. How many percentage points is that?', ['50', '5', '10'], 2, '30% minus 20% is an increase of 10 percentage points.'],
    ],
  },
  {
    title: 'Find the assumption',
    questions: [
      ['“Everyone will pay because my three friends like the idea.” What is the unsupported step?', ['Assuming three friends represent all potential customers', 'Asking friends for feedback', 'Having a product idea'], 0, 'The feedback is useful, but three friends do not establish willingness to pay across a whole audience.'],
      ['Which statement is a hypothesis rather than a measured result?', ['18 of 30 testers finished the task', 'Weekly competitions may help users return', 'The test lasted seven days'], 1, '“May help” is a proposed explanation or prediction that still needs testing.'],
      ['Which question best checks a claim that a feature saves time?', ['Do you like the feature name?', 'Does the feature have an icon?', 'Compared with what previous method, and how was time measured?'], 2, 'A useful time-saving claim needs a comparison and a defined measurement.'],
    ],
  },
  {
    title: 'Think about the sample',
    questions: [
      ['You survey only people who finished a course. What may be missing?', ['The experiences of people who dropped out', 'The course title', 'All opinions about courses'], 0, 'Sampling only finishers excludes the people whose reasons for dropping out may be important.'],
      ['Which sample is more relevant to a product for US adults aged 25–45?', ['Only the founders of the product', 'People in that age range and market with the target problem', 'Only people under 18'], 1, 'The target audience with the target problem is the more relevant group for early feedback.'],
      ['What should you report if the number of people invited to a survey is unknown?', ['A 100% response rate', 'An estimated rate presented as exact', 'The response count, with the response rate marked unknown'], 2, 'Without the invitation denominator, an exact response rate cannot be calculated.'],
    ],
  },
  {
    title: 'Follow the logic',
    questions: [
      ['All members of Team A completed onboarding. Sam is in Team A. What follows?', ['Sam completed onboarding', 'Sam won the competition', 'Only Team A completed onboarding'], 0, 'Sam belongs to the group for which completion was stated, so Sam completed onboarding.'],
      ['“If the file is approved, it is published.” The file is published. Can approval be concluded from this statement alone?', ['Yes, always', 'No; it might have been published another way', 'The file cannot exist'], 1, 'The statement does not say that approval is the only possible route to publication.'],
      ['Which statement contradicts “No participants submitted twice”?', ['Some participants submitted once', 'Some participants did not submit', 'At least one participant submitted twice'], 2, 'A single participant submitting twice is enough to contradict the word no.'],
    ],
  },
  {
    title: 'Compare like with like',
    questions: [
      ['Plan A costs $5 each month; Plan B costs $48 for one year. What is Plan B’s monthly equivalent?', ['$4', '$48', '$0.48'], 0, 'Dividing $48 by 12 months gives $4 per month.'],
      ['One group practiced for a week and another for a month. What makes a raw total comparison incomplete?', ['The group with more people must win', 'The groups had different amounts of time', 'Practice cannot be counted'], 1, 'Different time windows can produce different totals even at the same daily rate.'],
      ['Which comparison is most useful for a personal progress claim?', ['Your result against an unrelated famous person', 'Today’s result against a guess', 'Your result against a recorded baseline using the same measure'], 2, 'Using the same measure and a recorded baseline makes the comparison interpretable.'],
    ],
  },
  {
    title: 'Make a testable next step',
    questions: [
      ['Which success criterion is easiest to check?', ['At least 8 of 10 testers complete the signup flow without help', 'The app feels perfect', 'Everyone loves the product'], 0, 'The criterion specifies the task, sample, threshold and level of help.'],
      ['A test did not measure long-term behavior. Which conclusion is appropriate?', ['It proves a permanent habit change', 'It only supports conclusions about the observed test period', 'It proves the feature has no value'], 1, 'A short observation does not establish a lasting effect beyond what was measured.'],
      ['A user fails to find the Join button. What is the most useful next step?', ['Assume every user will fail', 'Add five more features', 'Observe the failure, adjust the flow, and test the changed step'], 2, 'A focused change and another observation address the specific problem that was seen.'],
    ],
  },
];

const WRITING_PROMPTS = [
  'Describe a small skill you want to improve. Explain why it matters, what makes practice difficult, and one action you can repeat tomorrow.',
  'Explain a familiar process to someone trying it for the first time. Give a clear starting point, ordered steps, and one common mistake to avoid.',
  'Write about a time you changed your mind. State your earlier view, the evidence or experience that changed it, and your current view.',
  'Describe a place or moment using concrete details. Include what you noticed and why the details matter to the reader.',
  'Make a case for one small improvement to your daily routine. Explain the problem, your proposed change, and how you would tell whether it helped.',
  'Summarize something you learned recently for a busy reader. Keep the main idea clear and give one example of how it can be used.',
  'Reflect on your practice this week. Describe what you attempted, one point of progress, one difficulty, and a realistic next step.',
];
const COMMUNICATION_PROMPTS = [
  'You need more time to finish a task. Draft a message that states the situation, the proposed new deadline, and what you can deliver before then.',
  'A teammate’s explanation is unclear. Write a respectful request for clarification, including the specific point you need and why it matters.',
  'Explain a concept you know to a beginner. Define the key term, use a concrete example, and avoid assuming specialist knowledge.',
  'Write constructive feedback on a fictional presentation that was well organized but hard to hear. Mention an observed strength and one actionable change.',
  'Draft a short update about a project that is partly complete. State what is done, what is still uncertain, and the next step with an owner or date.',
  'You disagree with a proposed approach. Explain the concern, give a reason or example, and suggest an alternative that can be discussed.',
  'Invite someone to join a seven-day practice challenge. Explain the goal, the daily commitment, the rules, and the action needed to join.',
];
const INTERVIEW_PROMPTS = [
  'Describe a real time you learned something unfamiliar. Use Situation, Task, Action, and Result. If you have no work example, use study or personal experience.',
  'Describe a real problem you helped solve. Explain your own contribution, the constraint you faced, and what happened. Keep any uncertain result honest.',
  'Tell a real story about receiving feedback. Explain the feedback, the change you made, and what you learned from trying it.',
  'Describe a real time you managed competing priorities. Explain how you decided what to do first, what you communicated, and the outcome.',
  'Explain a real mistake or setback. Take responsibility for your part, describe the correction, and give one lesson you now use.',
  'Describe a real collaboration. Explain the shared objective, your role, how you coordinated, and the outcome you can actually support.',
  'Write a concise introduction for an interview. Connect your experience, a relevant strength, and the kind of contribution you want to make next.',
];

function dayIndex(date: string): number {
  const normalized = date.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) throw new Error('A valid task date is required.');
  const time = Date.parse(`${normalized}T12:00:00Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== normalized) {
    throw new Error('A valid task date is required.');
  }
  return ((Math.floor(time / 86_400_000) % 7) + 7) % 7;
}

function optionOrder(key: string, count: number): number[] {
  let hash = 2166136261;
  for (const character of key) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  const shift = hash % count;
  return Array.from({ length: count }, (_, i) => (i + shift) % count);
}

/** Return the server task with keys. Route handlers must strip `answer` before sending questions. */
export function getChallenge(templateId: string, level: Level, date: string): FullTaskChallenge {
  const template = TEMPLATES.find(item => item.id === templateId);
  if (!template) throw new Error('Unknown goal template.');
  if (!(['light', 'standard', 'stretch'] as string[]).includes(level)) throw new Error('Unknown goal level.');
  const index = dayIndex(date);
  const points = template.levels[level].points;
  const base = { taskDate: date.slice(0, 10), goalId: '', title: template.title, verification: template.verification, points };
  const banks: Record<string, Pack[]> = {
    'spanish-daily': SPANISH,
    'javascript-daily': JAVASCRIPT,
    'critical-thinking': THINKING,
  };
  if (template.verification === 'quiz') {
    const pack = banks[templateId][index];
    const count = { light: 1, standard: 2, stretch: 3 }[level];
    return {
      ...base,
      prompt: `${pack.title}. Answer ${count === 1 ? 'this question' : `all ${count} questions`} correctly to complete today’s practice. You can read the feedback and try again.`,
      questions: pack.questions.slice(0, count).map(([question, options, answer, explanation], q) => {
        const order = optionOrder(`${templateId}:${date.slice(0, 10)}:${q}`, options.length);
        return {
          id: `${templateId}-${index}-${q}`, question,
          options: order.map(i => options[i]), answer: order.indexOf(answer), explanation,
        };
      }),
    };
  }
  if (template.verification === 'writing') {
    const prompts = templateId === 'clear-communication' ? COMMUNICATION_PROMPTS
      : templateId === 'interview-stories' ? INTERVIEW_PROMPTS : WRITING_PROMPTS;
    const minWords = { light: 50, standard: 100, stretch: 200 }[level];
    return {
      ...base,
      prompt: `${prompts[index]}\n\nWrite at least ${minWords} words. Your submission is checked for length; writing quality and the truth of your story are not automatically graded. Avoid confidential information.`,
      minWords,
    };
  }
  const minutes = { light: 5, standard: 15, stretch: 25 }[level];
  return {
    ...base,
    prompt: `Choose one concrete skill-practice task. Put distractions aside and use your own timer for ${minutes} minutes. At the end, note what you practiced and mark the session complete. This is a self-reported completion, not automatic activity tracking.`,
  };
}
