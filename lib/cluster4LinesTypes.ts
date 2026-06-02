export type Cluster4LineStatus = "void" | "pending" | "success" | "fail";

export type Cluster4LinePartType =
  | "info"
  | "experience"
  | "competency"
  | "career";

export type Cluster4LineTargetMode = "user" | "rule";

export type Cluster4VisibleLineDto = {
  lineId: string;
  lineTargetId: string;
  partType: Cluster4LinePartType;
  targetMode: Cluster4LineTargetMode;
  // 라인명(master.line_name) — mainTitle(main_title)과 별개. info part 는 null 일 수 있음.
  lineName: string | null;
  mainTitle: string;
  outputLink1: string | null;
  submissionOpensAt: string;
  submissionClosesAt: string;
};

export type Cluster4LineSubmissionDto = {
  id: string;
  lineTargetId: string;
  subtitle: string | null;
  outputLink2: string | null;
  outputLink3: string | null;
  outputLink4: string | null;
  outputLink5: string | null;
  submittedAt: string;
  updatedAt: string;
};

export type Cluster4LineDetailDto = {
  status: Cluster4LineStatus;
  partType: Cluster4LinePartType;
  line: Cluster4VisibleLineDto | null;
  submission: Cluster4LineSubmissionDto | null;
};

export type Cluster4LineSubmissionInput = {
  subtitle: string | null;
  outputLink2: string | null;
  outputLink3: string | null;
  outputLink4: string | null;
  outputLink5: string | null;
};
