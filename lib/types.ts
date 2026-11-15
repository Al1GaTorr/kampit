export type Level = 'light' | 'standard' | 'stretch';
export type Tier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';
export type Verification = 'quiz' | 'writing' | 'self';
export interface GoalTemplate { id:string; title:string; category:string; icon:string; color:string; description:string; verification:Verification; levels:Record<Level,{label:string;description:string;points:number}>; }
export interface Profile { id:string; name:string; interests:string[]; timezone:string; primeDemo:boolean; onboarded:boolean; }
export interface GoalView { id:string; templateId:string; level:Level; createdAt:string; completedToday:boolean; points:number; title:string; category:string; verification:Verification; nextLevel:Level|null; nextLevelStartsAt:string|null; }
export interface CompetitionView { id:string; name:string; description:string; kind:'global'|'friends'; members:number; joined:boolean; code?:string; endsAt:string; }
export interface LeaderboardEntry { userId:string; name:string; score:number; streak:number; tier:Tier; isYou:boolean; position:number; }
export interface AppState { mode:'account'|'demo'|'anonymous'; viewer:Profile|null; templates:GoalTemplate[]; goals:GoalView[]; today:{date:string;score:number;limit:number;streak:number;completedCount:number;plannedCount:number;completedPlannedCount:number;planComplete:boolean;nextResetAt:string}; week:{id:string;label:string;startsAt:string;endsAt:string;days:{date:string;label:string;score:number}[]}; rank:{tier:Tier;nextTier:Tier|null;activeDays:number;qualifyingDays:number;members:number;position:number|null}; competitions:CompetitionView[]; leaderboard:LeaderboardEntry[];history:WeeklySummary[]; }
export interface TaskChallenge { taskDate:string;goalId:string;title:string;verification:Verification;prompt:string;questions?:{id:string;question:string;options:string[]}[];minWords?:number;points:number; }
export interface ApiResponse { state:AppState; message?:string; result?:{passed?:boolean;awarded?:number;feedback?:string;code?:string}; }

export interface WeeklySummary { id:string;label:string;startsAt:string;endsAt:string;score:number;activeDays:number;completedCount:number;previousScore:number|null;position:number|null;participants:number|null;scopeName:string;rankBefore:Tier|null;rankAfter:Tier|null;rankReason:string; }
export interface PracticeRecord { id:string;date:string;title:string;verification:Verification;points:number;prompt:string;submission:string|null; }
export interface WeekDetail { summary:WeeklySummary;activities:PracticeRecord[]; }
