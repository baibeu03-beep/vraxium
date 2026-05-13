"use client";

// #ToDo 커리어넷 API 키 발급 후 전국 학교 목록 연동

import { useState, useRef, useCallback, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams, usePathname } from "next/navigation";
import { useDataMasking } from "@/hooks/useDataMasking";
import { isDemoMode as checkDemoMode } from "@/utils/isDemoMode";
import { useModalScroll } from "@/utils/useModalScroll";
import { isAdminEmail } from "@/lib/admin";
import { isPxRoute, isEcRoute } from "@/lib/cluster-route";
import { usePopup } from "@/components/ui/popup";
import { logEvent } from "@/utils/blackScreenDiagnostics";
import { CLUSTER2_DUMMY_PHOTOS, CLUSTER2_DUMMY_SLOGANS, CLUSTER2_DUMMY_VIDEOS, CLUSTER2_DUMMY_EDUCATIONS, CLUSTER2_DUMMY_REVIEWS, CLUSTER2_DUMMY_INTRO, CLUSTER2_DUMMY_BY_USER, DEFAULT_DEMO_USER } from "@/constants/dummyData";
import { SECTION1_PHOTO_DEFAULTS } from "@/constants/dummyData/cluster2-section1-default";
import { SECTION2_SLOGAN_DEFAULTS } from "@/constants/dummyData/cluster2-section2-default";

// 학력 데이터 타입
interface EduData {
  eduLevel: string; // 학력 (대학원/대학교/고등학교/중학교)
  school: string;
  status: string;
  category: string;
  major1: string;
  major2: string;
  major3: string;
  period: string;
  startYear?: string;
  startMonth?: string;
  endYear?: string;
  endMonth?: string;
  gradeMax: string; // 최대치 (4.5/4.3/100%/9등급/기타)
  gradeValue: string; // 달성치
  description: string;
  isFinal?: boolean;
}

// 학교 검색 응답 item 타입 — /api/schools/search 가 반환하는 정규화된 shape.
// fallback 경로(NEIS/정적 JSON)에서도 동일 shape 으로 통일됨.
// 단 외부 cache / 기존 캐싱 데이터로 인해 일시적으로 string 이 섞일 가능성을 대비해
// 렌더 단에서 getSchoolDisplayName() 으로 normalize 함.
interface SchoolSearchItem {
  id: string;
  name: string;
  school_name: string;
  schoolType: string;
  school_type: string;
  region: string | null;
}

// 응답 item / 잔존 string 양쪽에서 표시명을 안전 추출.
// 우선순위: school_name → name → 문자열 그대로.
function getSchoolDisplayName(item: SchoolSearchItem | string | null | undefined): string {
  if (!item) return "";
  if (typeof item === "string") return item;
  return item.school_name ?? item.name ?? "";
}

// 한글 학력 라벨 ↔ DB school_type 영문 매핑 (단일 소스).
// API 측과 동일 — 양방향 검증/표시에 사용.
const SCHOOL_TYPE_BY_EDU_LEVEL: { [key: string]: string } = {
  초등학교: "elementary",
  중학교: "middle",
  고등학교: "high",
  대학교: "university",
};

// 학력 데이터 (기본값 - DB에서 로드되면 덮어씀)
const initialEducationData: EduData[] = [
  {
    eduLevel: "-",
    school: "-",
    status: "-",
    category: "-",
    major1: "-",
    major2: "-",
    major3: "-",
    period: "-",
    startYear: "",
    startMonth: "",
    endYear: "",
    endMonth: "",
    gradeMax: "-",
    gradeValue: "-",
    description: "-",
    isFinal: true,
  },
];

// 물결 파동 타입
interface Ripple {
  id: number;
  x: number;
  y: number;
}

// Slogan 옵션 8개
const sloganOptions = ["Dreamer", "Commander", "Nomad", "Scholar", "Warrior", "Agent", "Pioneer", "Architect"];

// 바이트 기반 텍스트 truncate (한글=2, 영문/기호=1, maxBytes 기준)
const truncateByBytes = (text: string, maxBytes: number): string => {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    bytes += text.charCodeAt(i) > 127 ? 2 : 1;
    if (bytes > maxBytes) {
      return text.slice(0, i) + "...";
    }
  }
  return text;
};

const Cluster2Content = () => {
  // 세션 및 본인 프로필 여부 확인
  const { data: session } = useSession();
  const { mask } = useDataMasking();
  const searchParams = useSearchParams();
  // PX(Phalanx) / EC(Encre) 라우트 감지 — 동적 하위 라우트 포함. 판정 로직은 lib/cluster-route.
  const pathname = usePathname();
  const isPX = isPxRoute(pathname);
  const isEC = isEcRoute(pathname);
  // 라우트별 인라인 강조색 — non-themed 는 기존 #FAAB07 (gold) 유지.
  // PX → PX green #1E9503, EC → Encre strong pink #FF4B70.
  const accentInline = isPX ? "#1E9503" : isEC ? "#FF4B70" : "#FAAB07";
  const { alert: showAlert, confirm: popupConfirm } = usePopup();
  const showConfirm = useCallback(
    async (message: string, onConfirm: () => void | Promise<void>) => {
      if (await popupConfirm(message)) {
        await onConfirm();
      }
    },
    [popupConfirm],
  );
  const urlUserId = searchParams.get("userId") || searchParams.get("userID");
  const demoNameParam = searchParams.get("demoName");
  const demoLookupName = demoNameParam || urlUserId;

  // 본인 프로필인지 확인: URL에 userId가 없거나, 로그인한 사용자 ID와 같으면 본인
  // 어드민(마더) 계정은 모든 프로필 편집 가능
  const isOwner = session?.user?.isAdmin || !urlUserId || (session?.user?.id === urlUserId);
  const isDemoMode = checkDemoMode();

  // 어드민이 다른 유저 편집 시 targetUserId를 API URL에 추가
  const apiUrl = (path: string) => {
    if (urlUserId && session?.user?.isAdmin) {
      const separator = path.includes('?') ? '&' : '?';
      return `${path}${separator}targetUserId=${urlUserId}`;
    }
    return path;
  };

  const [currentPage, setCurrentPage] = useState(0);
  const [isWiggling, setIsWiggling] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEdu, setSelectedEdu] = useState<EduData | null>(null);

  // 승인 상태 관련 (TODO: 프로덕션 배포 전 복원)
  // const [isApproved, setIsApproved] = useState(false);
  // const checkApprovalStatus = async () => {
  //   if (!session) return false;
  //   try {
  //     const response = await fetch('/api/auth/check-status');
  //     const result = await response.json();
  //     if (result.success && result.status === 'approved') {
  //       setIsApproved(true);
  //       return true;
  //     } else {
  //       setIsApproved(false);
  //       return false;
  //     }
  //   } catch (error) {
  //     console.error('승인 상태 확인 오류:', error);
  //     setIsApproved(false);
  //     return false;
  //   }
  // };

  // 수정 버튼 클릭 핸들러 (승인 상태 체크)
  const handleEditClick = async (openModalFn: () => void) => {
    if (isDemoMode) {
      openModalFn();
      return;
    }
    if (!session) {
      alert("로그인이 필요합니다.");
      return;
    }
    openModalFn();
  };

  // 섹션 1 모달 (프로필 사진 수정)
  const [section1ModalOpen, setSection1ModalOpen] = useState(false);
  const [photos, setPhotos] = useState<(string | null)[]>([...SECTION1_PHOTO_DEFAULTS.photos]);
  const [sidebarPhoto, setSidebarPhoto] = useState<string | null>(null);
  const [mainPhoto, setMainPhoto] = useState<string | null>(null);
  const [subPhotos, setSubPhotos] = useState<(string | null)[]>([null, null, null, null]);
  const [starredPhoto, setStarredPhoto] = useState<number | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoSaving, setPhotoSaving] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [photosSnapshot, setPhotosSnapshot] = useState<(string | null)[]>([null, null, null, null, null, null]);
  const [footerNotice, setFooterNotice] = useState<"default" | "error">("default");
  const photoFileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const normalizeDirtyValue = (value: unknown): unknown => {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value.trim();
    if (Array.isArray(value)) return value.map((item) => normalizeDirtyValue(item));
    if (typeof value === "object") {
      return Object.keys(value as Record<string, unknown>)
        .sort()
        .reduce(
          (acc, key) => {
            (acc as Record<string, unknown>)[key] = normalizeDirtyValue((value as Record<string, unknown>)[key]);
            return acc;
          },
          {} as Record<string, unknown>,
        );
    }
    return value;
  };

  const isDirtyBySnapshot = (current: unknown, snapshot: unknown) => JSON.stringify(normalizeDirtyValue(current)) !== JSON.stringify(normalizeDirtyValue(snapshot));

  const isSection1Dirty = () => isDirtyBySnapshot(photos, photosSnapshot);

  // 사진 슬롯 활성화 판단
  const isSlotEnabled = (index: number): boolean => {
    if (index === 0) return true;
    return photos[index - 1] !== null;
  };

  // 사진 업로드 클릭
  const handlePhotoUploadClick = (index: number) => {
    photoFileInputRefs.current[index]?.click();
  };

  // 파일 선택 완료
  //   - 즉시 blob URL 로 임시 preview (UX 매끄러움용)
  //   - 동시에 /api/photos/upload 로 올려 storage public URL 을 받아 교체
  //   - upload 실패 시 슬롯 비우고 alert
  // ※ DB 저장 payload 에는 blob URL 을 절대 보내지 않는다 (handleSavePhotos sanitize).
  const handlePhotoFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    index: number,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setPhotos((prev) => {
      const newPhotos = [...prev];
      newPhotos[index] = previewUrl;
      return newPhotos;
    });

    if (isDemoMode) {
      // demo 모드는 DB 저장이 없으므로 blob 그대로 둠
      return;
    }

    setPhotoLoading(true);
    const uploadedUrl = await uploadPhoto(file, `slot${index}`);
    setPhotoLoading(false);

    // blob 해제 (성공/실패 관계 없이)
    URL.revokeObjectURL(previewUrl);

    setPhotos((prev) => {
      const newPhotos = [...prev];
      // 사용자가 그 사이에 같은 슬롯을 다시 바꾸지 않았을 때만 교체
      if (newPhotos[index] === previewUrl) {
        newPhotos[index] = uploadedUrl ?? null;
      }
      return newPhotos;
    });
  };

  // 사진 삭제
  const handlePhotoDelete = (index: number) => {
    setPhotos((prev) => {
      const newPhotos = [...prev];
      if (newPhotos[index]) {
        URL.revokeObjectURL(newPhotos[index]!);
      }
      newPhotos[index] = null;
      return newPhotos;
    });
  };

  // 이미지 압축 함수 (2MB 이하로)
  const compressImage = async (file: File, maxSizeMB: number = 2): Promise<File> => {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();

      img.onload = () => {
        let { width, height } = img;
        const maxDimension = 1200; // 최대 1200px

        // 크기 조정
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else {
            width = (width / height) * maxDimension;
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);

        // 품질 조정하면서 압축
        let quality = 0.9;
        const tryCompress = () => {
          canvas.toBlob(
            (blob) => {
              if (blob && blob.size <= maxSizeMB * 1024 * 1024) {
                resolve(new File([blob], file.name, { type: "image/jpeg" }));
              } else if (quality > 0.1) {
                quality -= 0.1;
                tryCompress();
              } else {
                resolve(new File([blob!], file.name, { type: "image/jpeg" }));
              }
            },
            "image/jpeg",
            quality,
          );
        };
        tryCompress();
      };

      img.src = URL.createObjectURL(file);
    });
  };

  // 사진 업로드 함수
  const uploadPhoto = async (file: File, photoType: string): Promise<string | null> => {
    try {
      // 2MB 초과시 압축
      let processedFile = file;
      if (file.size > 2 * 1024 * 1024) {
        processedFile = await compressImage(file);
      }

      const formData = new FormData();
      formData.append("file", processedFile);
      formData.append("type", photoType);

      const response = await fetch(apiUrl("/api/photos/upload"), {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      if (result.success) {
        return result.url;
      } else {
        showAlert(result.error || "사진 업로드에 실패했습니다.");
        return null;
      }
    } catch (error) {
      console.error("사진 업로드 오류:", error);
      showAlert("사진 업로드 중 오류가 발생했습니다.");
      return null;
    }
  };

  // DB에서 사진 로드
  const fetchPhotos = async () => {
    if (isDemoMode) {
      const demoUser = demoLookupName || DEFAULT_DEMO_USER;
      const userData = CLUSTER2_DUMMY_BY_USER[demoUser] || CLUSTER2_DUMMY_BY_USER[DEFAULT_DEMO_USER];
      setSidebarPhoto(userData.photos.mainPhoto);
      setMainPhoto(userData.photos.mainPhoto);
      setSubPhotos(userData.photos.subPhotos);
      return;
    }
    setPhotoLoading(true);
    try {
      // 비소유자인 경우 userId 쿼리 파라미터로 조회
      const url = urlUserId ? `/api/photos?userId=${urlUserId}` : "/api/photos";
      const response = await fetch(url);
      const result = await response.json();

      if (result.success && result.data) {
        // 이미지 프리로드: URL을 받자마자 브라우저가 다운로드 시작
        const allUrls = [result.data.sidebarPhoto, result.data.mainPhoto, ...(result.data.subPhotos || [])].filter(Boolean);
        allUrls.forEach((imgUrl: string) => {
          const link = document.createElement("link");
          link.rel = "preload";
          link.as = "image";
          link.href = imgUrl;
          document.head.appendChild(link);
        });

        setSidebarPhoto(result.data.sidebarPhoto || null);
        setMainPhoto(result.data.mainPhoto || null);
        setSubPhotos(result.data.subPhotos || [null, null, null, null]);
      }
    } catch (error) {
      console.error("사진 로드 오류:", error);
    } finally {
      setPhotoLoading(false);
    }
  };

  // 세션 변경 시 또는 다른 유저 프로필 조회 시 사진 로드
  useEffect(() => {
    if (isOwner && session) {
      fetchPhotos();
    } else if (!isOwner && urlUserId) {
      fetchPhotos();
    }
  }, [session, isOwner, urlUserId]);

  // 사진 저장 함수
  const handleSavePhotos = async () => {
    // 1. 빈자리 재정렬
    const compacted = photos.filter((p) => p !== null);
    const reordered = [...compacted, ...Array(6 - compacted.length).fill(null)] as (string | null)[];
    setPhotos(reordered);

    // 2. 상태 연동 (슬롯 0: Sidebar, 1: 메인, 2~5: 육각형)
    const nextSidebar = reordered[0];
    const nextMain = reordered[1];
    const nextSubs = [reordered[2], reordered[3], reordered[4], reordered[5]];
    setSidebarPhoto(nextSidebar);
    setMainPhoto(nextMain);
    setSubPhotos(nextSubs);

    // 3. Sidebar 프로필 사진 실시간 반영 (photoUpdated 리스너)
    if (nextSidebar !== undefined) {
      window.dispatchEvent(new CustomEvent("photoUpdated", { detail: { photo: nextSidebar } }));
    }

    // 4. 스냅샷 업데이트 (저장 후 dirty 비교 기준 갱신)
    setPhotosSnapshot([...reordered]);

    // 5. API 호출 (데모 모드 분기)
    if (isDemoMode) {
      console.log("TODO: 저장 API 호출", reordered);
      showAlert("저장되었습니다.");
      setSection1ModalOpen(false);
      return;
    }
    // blob:/data:/file: 같은 local preview URL 은 DB 에 저장하지 않는다.
    // (upload 실패한 슬롯, 또는 새로고침 전 임시 state 가 남은 경우)
    const isLocalPreviewUrl = (value?: string | null) =>
      !!value &&
      (value.startsWith("blob:") ||
        value.startsWith("data:") ||
        value.startsWith("file:"));
    const sanitizePersistedUrl = (value?: string | null) => {
      if (!value) return null;
      if (isLocalPreviewUrl(value)) return null;
      return value;
    };

    const persistedSidebar = sanitizePersistedUrl(nextSidebar);
    const persistedMain = sanitizePersistedUrl(nextMain);
    const persistedSubs = nextSubs.map(sanitizePersistedUrl);

    const localOnlyCount =
      (isLocalPreviewUrl(nextSidebar) ? 1 : 0) +
      (isLocalPreviewUrl(nextMain) ? 1 : 0) +
      nextSubs.filter(isLocalPreviewUrl).length;
    if (localOnlyCount > 0) {
      showAlert(
        `${localOnlyCount}개 슬롯의 업로드가 완료되지 않아 해당 슬롯은 저장에서 제외됩니다.`,
      );
    }

    setPhotoSaving(true);
    try {
      const response = await fetch(apiUrl("/api/photos"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sidebarPhoto: persistedSidebar,
          mainPhoto: persistedMain,
          subPhotos: persistedSubs,
        }),
      });

      const result = await response.json();
      if (result.success) {
        showAlert("저장되었습니다.");
        setSection1ModalOpen(false);
      } else {
        showAlert(result.error || "사진 저장에 실패했습니다.");
      }
    } catch (error) {
      console.error("사진 저장 오류:", error);
      showAlert("사진 저장 중 오류가 발생했습니다.");
    } finally {
      setPhotoSaving(false);
    }
  };

  // 파일 input refs
  const mainPhotoInputRef = useRef<HTMLInputElement>(null);
  const subPhotoInputRef = useRef<HTMLInputElement>(null);
  const [currentSubIndex, setCurrentSubIndex] = useState<number>(0);

  // 메인 사진 변경 핸들러
  const handleMainPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoLoading(true);
      const url = await uploadPhoto(file, "main");
      if (url) {
        setMainPhoto(url);
      }
      setPhotoLoading(false);
    }
    e.target.value = "";
  };

  // 서브 사진 업로드 핸들러 - 순서대로 채움
  const handleSubPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoLoading(true);
      // 업로드할 슬롯 결정
      const targetIndex = subPhotos.findIndex((photo) => !photo);
      const uploadIndex = targetIndex !== -1 ? targetIndex : currentSubIndex;
      const photoType = `sub${uploadIndex + 1}`;

      const url = await uploadPhoto(file, photoType);
      if (url) {
        setSubPhotos((prev) => {
          const newPhotos = [...prev];
          newPhotos[uploadIndex] = url;
          return newPhotos;
        });
      }
      setPhotoLoading(false);
    }
    e.target.value = "";
  };

  // 서브 사진 삭제 핸들러 - 삭제 후 순서 재정렬
  const handleSubPhotoDelete = (index: number) => {
    setSubPhotos((prev) => {
      prev.filter((_, i) => i !== index || !prev[index]);
      // 삭제된 사진이 있으면 앞으로 당기고 뒤에 null 추가
      const filledPhotos = prev.filter((photo, i) => i !== index && photo);
      while (filledPhotos.length < 4) {
        filledPhotos.push(null);
      }
      return filledPhotos;
    });
    // 삭제된 사진이 대표 사진이었으면 해제
    if (starredPhoto === index) {
      setStarredPhoto(null);
    } else if (starredPhoto !== null && starredPhoto > index) {
      // 대표 사진 인덱스 조정
      setStarredPhoto(starredPhoto - 1);
    }
  };

  // 메인 사진 삭제 핸들러 - 첫번째 서브 사진이 메인으로
  const handleMainPhotoDelete = () => {
    const firstSubPhoto = subPhotos.find((photo) => photo);
    if (firstSubPhoto) {
      setMainPhoto(firstSubPhoto);
      // 서브 사진 재정렬
      const remainingPhotos = subPhotos.filter((photo) => photo !== firstSubPhoto);
      while (remainingPhotos.length < 4) {
        remainingPhotos.push(null);
      }
      setSubPhotos(remainingPhotos);
      // 대표 사진 인덱스 조정
      if (starredPhoto !== null && starredPhoto > 0) {
        setStarredPhoto(starredPhoto - 1);
      } else if (starredPhoto === 0) {
        setStarredPhoto(null);
      }
    } else {
      setMainPhoto(null);
    }
  };

  // 대표 사진 설정 핸들러 - 사진이 있어야만 설정 가능, 메인 사진으로 변경
  const handleSetStarred = (index: number) => {
    if (!subPhotos[index]) return; // 사진이 없으면 무시

    // 선택한 서브 사진을 메인 사진으로 변경
    const selectedPhoto = subPhotos[index];
    const currentMainPhoto = mainPhoto;

    // 메인 사진 변경
    setMainPhoto(selectedPhoto);

    // 서브 사진 재구성: 선택한 사진 위치에 기존 메인 사진 넣기
    setSubPhotos((prev) => {
      const newPhotos = [...prev];
      newPhotos[index] = currentMainPhoto;
      return newPhotos;
    });

    // 대표 사진 표시 해제
    setStarredPhoto(null);
  };

  // 섹션 2 모달 (슬로건 편집)
  const [section2ModalOpen, setSection2ModalOpen] = useState(false);
  const [sloganData, setSloganData] = useState({
    slogan1: { option: "", content: "", rating: 0 },
    slogan2: { option: "", content: "", rating: 0 },
    slogan3: { option: "", content: "", rating: 0 },
  });
  const [editingSloganData, setEditingSloganData] = useState(sloganData);
  const [dropdown1Open, setDropdown1Open] = useState(false);
  const [dropdown2Open, setDropdown2Open] = useState(false);
  const [dropdown3Open, setDropdown3Open] = useState(false);
  const [sloganSaving, setSloganSaving] = useState(false);
  const [sloganSnapshot, setSloganSnapshot] = useState(sloganData);
  const isSection2Dirty = () => isDirtyBySnapshot(editingSloganData, sloganSnapshot);
  const [section2FooterNotice, setSection2FooterNotice] = useState<"default" | "error">("default");
  const [sloganAuthorName, setSloganAuthorName] = useState("");

  // DB에서 슬로건 로드
  const fetchSlogans = async () => {
    if (isDemoMode) {
      const demoUser = demoLookupName || DEFAULT_DEMO_USER;
      const userData = CLUSTER2_DUMMY_BY_USER[demoUser] || CLUSTER2_DUMMY_BY_USER[DEFAULT_DEMO_USER];
      const newSloganData = {
        slogan1: { option: userData.slogans.slogan1.option, content: userData.slogans.slogan1.content, rating: userData.slogans.slogan1.rating },
        slogan2: { option: userData.slogans.slogan2.option, content: userData.slogans.slogan2.content, rating: userData.slogans.slogan2.rating },
        slogan3: { option: userData.slogans.slogan3.option, content: userData.slogans.slogan3.content, rating: userData.slogans.slogan3.rating },
      };
      setSloganData(newSloganData);
      setEditingSloganData(newSloganData);
      setSloganAuthorName(userData.slogans.engName);
      return;
    }
    try {
      const url = urlUserId ? `/api/slogans?userId=${urlUserId}` : "/api/slogans";
      const response = await fetch(url);
      const result = await response.json();

      if (result.success && result.data) {
        const newSloganData = {
          slogan1: {
            option: result.data.slogan1?.option || "",
            content: result.data.slogan1?.content || "",
            rating: result.data.slogan1?.rating ?? 0,
          },
          slogan2: {
            option: result.data.slogan2?.option || "",
            content: result.data.slogan2?.content || "",
            rating: result.data.slogan2?.rating ?? 0,
          },
          slogan3: {
            option: result.data.slogan3?.option || "",
            content: result.data.slogan3?.content || "",
            rating: result.data.slogan3?.rating ?? 0,
          },
        };
        setSloganData(newSloganData);
        setEditingSloganData(newSloganData);

        // 영어 이름 설정
        if (result.data.engName) {
          setSloganAuthorName(result.data.engName);
        }
      }
    } catch (error) {
      console.error("슬로건 로드 오류:", error);
    }
  };

  // 세션 변경 시 또는 다른 유저 프로필 조회 시 슬로건 로드
  useEffect(() => {
    if (isOwner && session) {
      fetchSlogans();
    } else if (!isOwner && urlUserId) {
      fetchSlogans();
    }
  }, [session, isOwner, urlUserId]);

  // 슬로건 저장
  const handleSaveSlogans = async () => {
    if (isDemoMode) {
      setSloganData(editingSloganData);
      window.dispatchEvent(new CustomEvent("sloganUpdated", { detail: editingSloganData }));
      showAlert("저장되었습니다.");
      setSection2ModalOpen(false);
      return;
    }
    setSloganSaving(true);
    try {
      const response = await fetch(apiUrl("/api/slogans"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slogan1: editingSloganData.slogan1,
          slogan2: editingSloganData.slogan2,
          slogan3: editingSloganData.slogan3,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setSloganData(editingSloganData);
        // 슬로건 변경을 Sidebar(.resume-card)에 알려 즉시 반영
        window.dispatchEvent(new CustomEvent("sloganUpdated", { detail: editingSloganData }));
        showAlert("저장되었습니다.");
        setSection2ModalOpen(false);
      } else {
        showAlert(result.error || "슬로건 저장에 실패했습니다.");
      }
    } catch (error) {
      console.error("슬로건 저장 오류:", error);
      showAlert("슬로건 저장 중 오류가 발생했습니다.");
    } finally {
      setSloganSaving(false);
    }
  };

  // 섹션 2-1 모달 (비디오 편집)
  const [section21ModalOpen, setSection21ModalOpen] = useState(false);
  const section21OverlayRef = useRef<HTMLDivElement>(null);
  const introOverlayRef = useRef<HTMLDivElement>(null);
  // YouTube 비디오 ID 추출 함수
  const extractYouTubeId = (url: string): string | null => {
    if (!url) return null;

    // youtu.be/VIDEO_ID 형식
    const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (shortMatch) return shortMatch[1];

    // youtube.com/watch?v=VIDEO_ID 형식
    const longMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (longMatch) return longMatch[1];

    // youtube.com/embed/VIDEO_ID 형식
    const embedMatch = url.match(/embed\/([a-zA-Z0-9_-]{11})/);
    if (embedMatch) return embedMatch[1];

    return null;
  };

  // YouTube 썸네일 URL 생성
  const getYouTubeThumbnail = (videoUrl: string): string => {
    const videoId = extractYouTubeId(videoUrl);
    if (!videoId) return "";
    // 최고 화질 썸네일 사용 (maxresdefault)
    return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  };

  const [videoData, setVideoData] = useState([
    {
      id: 1,
      title: "Eclipse Journey",
      author: "Eng Name",
      viewers: "9.9k Viewers",
      thumbnail: "/images/0/cluster 2/영상 01.jpeg",
      isBookmarked: true,
      videoUrl: "",
    },
    {
      id: 2,
      title: "Eclipse Journey",
      author: "Eng Name",
      viewers: "9.9k Viewers",
      thumbnail: "999",
      isBookmarked: true,
      videoUrl: "",
    },
    {
      id: 3,
      title: "Eclipse Journey",
      author: "Eng Name",
      viewers: "9.9k Viewers",
      thumbnail: "999",
      isBookmarked: true,
      videoUrl: "",
    },
  ]);
  const [editingVideoData, setEditingVideoData] = useState(videoData);
  const [videoSaving, setVideoSaving] = useState(false);
  const [videoSnapshot, setVideoSnapshot] = useState(videoData);
  const isSection21Dirty = () => isDirtyBySnapshot(editingVideoData, videoSnapshot);
  const [videoPage, setVideoPage] = useState(0);
  const VIDEOS_PER_PAGE = 3;

  // DB에서 영상 URL 로드
  const fetchVideos = async () => {
    if (isDemoMode) {
      const demoUser = demoLookupName || DEFAULT_DEMO_USER;
      const userData = CLUSTER2_DUMMY_BY_USER[demoUser] || CLUSTER2_DUMMY_BY_USER[DEFAULT_DEMO_USER];
      setVideoData((prev) => {
        const newData = [...prev];
        newData.forEach((video) => {
          video.author = userData.slogans.engName;
        });
        if (userData.videos.videoUrl1) {
          newData[0].videoUrl = userData.videos.videoUrl1;
          newData[0].thumbnail = getYouTubeThumbnail(userData.videos.videoUrl1);
        }
        if (userData.videos.videoUrl2) {
          newData[1].videoUrl = userData.videos.videoUrl2;
          newData[1].thumbnail = getYouTubeThumbnail(userData.videos.videoUrl2);
        }
        if (userData.videos.videoUrl3) {
          newData[2].videoUrl = userData.videos.videoUrl3;
          newData[2].thumbnail = getYouTubeThumbnail(userData.videos.videoUrl3);
        }
        return newData;
      });
      return;
    }
    try {
      const url = urlUserId ? `/api/videos?userId=${urlUserId}` : "/api/videos";
      const response = await fetch(url);
      const result = await response.json();

      if (result.success && result.data) {
        const authorName = result.data.engName || "Unknown";
        setVideoData((prev) => {
          const newData = [...prev];
          // 모든 영상에 영어 이름 설정
          newData.forEach((video) => {
            video.author = authorName;
          });
          if (result.data.videoUrl1) {
            newData[0].videoUrl = result.data.videoUrl1;
            newData[0].thumbnail = getYouTubeThumbnail(result.data.videoUrl1);
          }
          if (result.data.videoUrl2) {
            newData[1].videoUrl = result.data.videoUrl2;
            newData[1].thumbnail = getYouTubeThumbnail(result.data.videoUrl2);
          }
          if (result.data.videoUrl3) {
            newData[2].videoUrl = result.data.videoUrl3;
            newData[2].thumbnail = getYouTubeThumbnail(result.data.videoUrl3);
          }
          return newData;
        });
      }
    } catch (error) {
      console.error("영상 로드 오류:", error);
    }
  };

  // 세션 변경 시 또는 다른 유저 프로필 조회 시 영상 로드
  useEffect(() => {
    if (isOwner && session) {
      fetchVideos();
    } else if (!isOwner && urlUserId) {
      fetchVideos();
    }
  }, [session, isOwner, urlUserId]);

  // 영상 URL 저장
  const handleSaveVideos = async () => {
    if (isDemoMode) {
      setVideoData([...editingVideoData]);
      showAlert("저장되었습니다.");
      setSection21ModalOpen(false);
      return;
    }
    setVideoSaving(true);
    try {
      const response = await fetch(apiUrl("/api/videos"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl1: editingVideoData[0]?.videoUrl || null,
          videoUrl2: editingVideoData[1]?.videoUrl || null,
          videoUrl3: editingVideoData[2]?.videoUrl || null,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setVideoData([...editingVideoData]);
        showAlert("저장되었습니다.");
        setSection21ModalOpen(false);
      } else {
        showAlert(result.error || "영상 저장에 실패했습니다.");
      }
    } catch (error) {
      console.error("영상 저장 오류:", error);
      showAlert("영상 저장 중 오류가 발생했습니다.");
    } finally {
      setVideoSaving(false);
    }
  };

  // 섹션 3 모달 (학력 편집)
  const [section3ModalOpen, setSection3ModalOpen] = useState(false);
  const [educationData, setEducationData] = useState<EduData[]>(initialEducationData);
  // 학력 카드 페이지네이션: 컨테이너 대비 카드 오버플로 시에만 동적 생성
  const [eduTotalPages, setEduTotalPages] = useState(1);
  const [eduSlideWidth, setEduSlideWidth] = useState(350);
  const eduContainerRef = useRef<HTMLDivElement>(null);
  const [editingEduData, setEditingEduData] = useState<EduData[]>(initialEducationData);
  const [hasEduChanges, setHasEduChanges] = useState(false); // 학력 변경사항 추적
  const [eduSaving, setEduSaving] = useState(false);
  const [eduValidationErrors, setEduValidationErrors] = useState<{ [key: string]: boolean }>({});
  const [canChangePrimary, setCanChangePrimary] = useState(false); // 대표학력 변경 허가 (관리자 승인 시 true)
  const [section3FooterNotice, setSection3FooterNotice] = useState<"default" | "error">("default");

  // 학력 데이터 변경 시 해당 필드의 에러 상태 자동 해제
  useEffect(() => {
    if (Object.keys(eduValidationErrors).length === 0) return;
    const updatedErrors = { ...eduValidationErrors };
    let changed = false;
    editingEduData.forEach((edu, index) => {
      if (updatedErrors[`${index}_school`] && edu.school && edu.school !== "-") {
        delete updatedErrors[`${index}_school`];
        changed = true;
      }
      if (updatedErrors[`${index}_status`] && edu.status && edu.status !== "-") {
        delete updatedErrors[`${index}_status`];
        changed = true;
      }
      if (updatedErrors[`${index}_category`] && edu.category) {
        delete updatedErrors[`${index}_category`];
        changed = true;
      }
      if (updatedErrors[`${index}_major1`] && edu.major1) {
        delete updatedErrors[`${index}_major1`];
        changed = true;
      }
      if (updatedErrors[`${index}_startYear`] && edu.startYear) {
        delete updatedErrors[`${index}_startYear`];
        changed = true;
      }
      if (updatedErrors[`${index}_startMonth`] && edu.startMonth) {
        delete updatedErrors[`${index}_startMonth`];
        changed = true;
      }
      if (updatedErrors[`${index}_endYear`] && edu.endYear) {
        delete updatedErrors[`${index}_endYear`];
        changed = true;
      }
      if (updatedErrors[`${index}_endMonth`] && edu.endMonth) {
        delete updatedErrors[`${index}_endMonth`];
        changed = true;
      }
      if (updatedErrors[`${index}_gradeValue`] && edu.gradeValue) {
        delete updatedErrors[`${index}_gradeValue`];
        changed = true;
      }
    });
    if (changed) setEduValidationErrors(updatedErrors);
  }, [editingEduData]);

  // 모든 카드 필수필드 충족 시 안내문 자동 복원
  useEffect(() => {
    if (section3FooterNotice !== "error") return;
    const allFilled = editingEduData.every((edu, index) => {
      if (index === 0 && !canChangePrimary) return true;
      return (
        edu.school &&
        edu.school !== "-" &&
        edu.status &&
        edu.status !== "-" &&
        edu.category &&
        edu.category !== "-" &&
        edu.major1 &&
        edu.major1 !== "-" &&
        edu.startYear &&
        edu.startMonth &&
        edu.gradeValue &&
        edu.gradeValue !== "-" &&
        edu.description &&
        edu.description.trim() !== "" &&
        (edu.status !== "졸업" || (edu.endYear && edu.endMonth)) &&
        (edu.status !== "중퇴" || (edu.endYear && edu.endYear.trim() !== ""))
      );
    });
    if (allFilled) {
      setSection3FooterNotice("default");
      setEduValidationErrors({});
    }
  }, [editingEduData, section3FooterNotice, canChangePrimary]);

  // 학력 페이지네이션: 컨테이너 vs 카드 전체 폭 비교하여 동적 계산
  useEffect(() => {
    const calculate = () => {
      const container = eduContainerRef.current;
      const wrapper = cardsRef.current;
      if (!container || !wrapper) return;

      const containerW = container.clientWidth;
      const totalW = wrapper.scrollWidth;

      if (totalW <= containerW) {
        setEduTotalPages(1);
        setCurrentPage(0);
      } else {
        // 카드 1장(274px) + gap(20px) + margin(30px) ≈ 324px 단위로 슬라이드
        const cardStep = 324;
        const overflow = totalW - containerW;
        const pages = Math.max(1, Math.ceil(overflow / cardStep) + 1);
        setEduTotalPages(pages);
        setEduSlideWidth(cardStep);
        setCurrentPage((prev) => Math.min(prev, pages - 1));
      }
    };

    calculate();
    const ro = new ResizeObserver(calculate);
    if (eduContainerRef.current) ro.observe(eduContainerRef.current);
    return () => ro.disconnect();
  }, [educationData]);

  // 학력 데이터 로드
  const fetchEducations = async () => {
    if (isDemoMode) {
      const demoUser = demoLookupName || DEFAULT_DEMO_USER;
      const userData = CLUSTER2_DUMMY_BY_USER[demoUser] || CLUSTER2_DUMMY_BY_USER[DEFAULT_DEMO_USER];
      setEducationData(userData.educations);
      setEditingEduData(userData.educations);
      return;
    }
    try {
      const url = urlUserId ? `/api/educations?userId=${urlUserId}` : "/api/educations";
      const response = await fetch(url);
      const result = await response.json();
      if (result.success && result.data && result.data.length > 0) {
        setEducationData(result.data);
        setEditingEduData(result.data);
      }
    } catch (error) {
      console.error("학력 로드 오류:", error);
    }
  };

  // 세션 변경 시 또는 다른 유저 프로필 조회 시 학력 로드
  useEffect(() => {
    if (isOwner && session) {
      fetchEducations();
    } else if (!isOwner && urlUserId) {
      fetchEducations();
    }
  }, [session, isOwner, urlUserId]);

  // 학력 저장 함수
  const handleSaveEducations = async (processedData: EduData[]) => {
    if (isDemoMode) {
      const primary = processedData[0];
      const isEmptyRequired = (value?: string) => !value || value.trim() === "" || value === "-";
      const isPrimaryCleared = !canChangePrimary && (!primary || isEmptyRequired(primary.school) || isEmptyRequired(primary.status) || isEmptyRequired(primary.category) || isEmptyRequired(primary.major1) || isEmptyRequired(primary.gradeValue));

      if (isPrimaryCleared) {
        showAlert("관리자 승인 후 수정할 수 있습니다.");
        return;
      }

      setEducationData(processedData);
      showAlert("저장되었습니다.");
      setSection3ModalOpen(false);
      return;
    }
    setEduSaving(true);
    try {
      const response = await fetch(apiUrl("/api/educations"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          educations: processedData,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setEducationData(processedData);
        setEditingEduData(processedData);
        setHasEduChanges(false);
        setEduValidationErrors({});
        setSection3ModalOpen(false);
        // 학력 변경을 Sidebar(.resume-card)에 알려 즉시 반영
        window.dispatchEvent(new Event("educationUpdated"));
        showAlert("저장되었습니다.");
      } else {
        showAlert(result.error || "학력 저장에 실패했습니다.");
      }
    } catch (error) {
      console.error("학력 저장 오류:", error);
      showAlert("학력 저장 중 오류가 발생했습니다.");
    } finally {
      setEduSaving(false);
    }
  };

  // 섹션 4 모달 (바로가기 링크 편집)
  const [section4ModalOpen, setSection4ModalOpen] = useState(false);
  const [reviewSnapshot, setReviewSnapshot] = useState<string[]>(["", "", "", "", "", "", "", "", "", ""]);
  const isSection4Dirty = () => isDirtyBySnapshot(editingReviewLinks, reviewSnapshot);

  // 수정_허가 데이터 (데모용 하드코딩, 추후 DB 연동)
  const reviewPermissions = [
    { label: "Total Complete", isOpen: true },
    { label: "3 weeks", isOpen: true },
    { label: "6 weeks", isOpen: true },
    { label: "9 weeks", isOpen: false },
    { label: "12 weeks", isOpen: false },
    { label: "15 weeks", isOpen: false },
    { label: "18 weeks", isOpen: false },
    { label: "21 weeks", isOpen: false },
    { label: "24 weeks", isOpen: false },
    { label: "27 weeks", isOpen: false },
  ];

  // 섹션 5 - 자기소개서 카드 데이터
  const defaultIntroContent = "-";
  const introComments: Record<string, string> = {
    "성장 과정": "본인이 어떤 환경과 과정을 통해 성장하였으며, 그것이 본인을 만들어가는 데에 있어 어떤 영향을 끼쳤는지 보여주세요. 😊",
    "사회 경험": "본인이 사회 속에서 겪은 활동, 경험들을 어필하고, 그 안에서 어떤 인사이트를 통해 어떤 성장을 이루었는지를 보여주세요. 😊",
    "커리어 방향": "본인이 나아가고자 하는 직무와 커리어가 어떤 것인지, 그리고 그것을 위해 어떤 준비와 경험을 쌓아왔는지를 보여주세요. 😊",
    "실무 스타일": "본인이 회사와 조직, 사업과 고객 속에서 어떤 방식으로 일을 처리하며, 그것을 실제로 느낄 수 있는 경험들을 보여주세요. 😊",
    "퍼스널 스토리": "업무와 별개로, 본인이 어떤 성격과 캐릭터, 개인적 경험 등을 가지고 있는 지를 바탕으로, 동료/구성원으로서의 매력을 보여주세요. 😊",
  };
  const [introCards, setIntroCards] = useState([
    {
      id: 1,
      icon: "/images/0/cluster 2/icon/01성장 과정.png",
      title: "성장 과정",
      subtitle: "저는 이렇게 성장하였습니다 😊",
      content: defaultIntroContent,
    },
    {
      id: 2,
      icon: "/images/0/cluster 2/icon/03사회 경험.png",
      title: "사회 경험",
      subtitle: "저는 이런 것들을 경험하였습니다 😊",
      content: defaultIntroContent,
    },
    {
      id: 3,
      icon: "/images/0/cluster 2/icon/02커리어 방향.png",
      title: "커리어 방향",
      subtitle: "저는 이 방향으로 나아가고자 합니다 😊",
      content: defaultIntroContent,
    },
    {
      id: 4,
      icon: "/images/0/cluster 2/icon/04실무 스타일.png",
      title: "실무 스타일",
      subtitle: "저는 이렇게 일합니다 😊",
      content: defaultIntroContent,
    },
    {
      id: 5,
      icon: "/images/0/cluster 2/icon/05퍼스널 스토리.png",
      title: "퍼스널 스토리",
      subtitle: "저는 이런 사람입니다 😊",
      content: defaultIntroContent,
    },
  ]);
  const [introModalOpen, setIntroModalOpen] = useState(false);
  const [selectedIntroCard, setSelectedIntroCard] = useState<number | null>(null);
  const [isEditingIntro, setIsEditingIntro] = useState(false);
  const [editingIntroData, setEditingIntroData] = useState({ content: "" });
  const [introSaving, setIntroSaving] = useState(false);
  const [introDirty, setIntroDirty] = useState(false);

  // 도움말 모달
  const [showHelpModal, setShowHelpModal] = useState(false);

  // 초기화용 초기 데이터 저장
  const [initialPhotos, setInitialPhotos] = useState<{ main: string | null; sub: (string | null)[] }>({ main: null, sub: [null, null, null, null] });
  const [initialSloganData, setInitialSloganData] = useState(sloganData);
  const [initialVideoData, setInitialVideoData] = useState(videoData);
  const [initialEduDataSnapshot, setInitialEduDataSnapshot] = useState<EduData[]>(initialEducationData);
  const isSection3Dirty = () => isDirtyBySnapshot(editingEduData, initialEduDataSnapshot);
  const [initialReviewLinksData, setInitialReviewLinksData] = useState<string[]>(["", "", "", "", "", "", "", "", "", ""]);
  const [initialIntroContent, setInitialIntroContent] = useState("");

  // 모달 열릴 때 배경 스크롤 잠금
  const anyModalOpen = section1ModalOpen || section2ModalOpen || section21ModalOpen || section3ModalOpen || section4ModalOpen || introModalOpen;
  useModalScroll(anyModalOpen);

  useEffect(() => {
    logEvent(section1ModalOpen ? "modal-open" : "modal-close", { source: "cluster-2", name: "section1-photo" });
  }, [section1ModalOpen]);

  useEffect(() => {
    logEvent(section2ModalOpen ? "modal-open" : "modal-close", { source: "cluster-2", name: "section2-slogan" });
  }, [section2ModalOpen]);

  useEffect(() => {
    logEvent(section21ModalOpen ? "modal-open" : "modal-close", { source: "cluster-2", name: "section21-video" });
  }, [section21ModalOpen]);

  useEffect(() => {
    logEvent(section3ModalOpen ? "modal-open" : "modal-close", { source: "cluster-2", name: "section3-education" });
  }, [section3ModalOpen]);

  useEffect(() => {
    logEvent(section4ModalOpen ? "modal-open" : "modal-close", { source: "cluster-2", name: "section4-review" });
  }, [section4ModalOpen]);

  useEffect(() => {
    logEvent(introModalOpen ? "modal-open" : "modal-close", { source: "cluster-2", name: "intro" });
  }, [introModalOpen]);

  useEffect(() => {
    logEvent(modalOpen ? "modal-open" : "modal-close", { source: "cluster-2", name: "education-detail" });
  }, [modalOpen]);

  useEffect(() => {
    logEvent(anyModalOpen ? "scroll-lock" : "scroll-unlock", { source: "cluster-2", reason: "anyModalOpen" });
  }, [anyModalOpen]);

  // section21 모달 배경 스크롤 차단 (native listener — passive: false 필수)
  useEffect(() => {
    if (!section21ModalOpen) return;
    const overlay = section21OverlayRef.current;
    if (!overlay) return;

    const handleWheel = (e: WheelEvent) => {
      const body = document.querySelector(".section21-modal-body") as HTMLElement | null;
      if (!body) {
        e.preventDefault();
        return;
      }
      const insideBody = body.contains(e.target as Node);
      if (!insideBody) {
        e.preventDefault();
        return;
      }

      if (e.shiftKey) {
        if (body.scrollWidth > body.clientWidth) {
          const canScrollX =
            (e.deltaY > 0 && body.scrollLeft + body.clientWidth < body.scrollWidth) ||
            (e.deltaY < 0 && body.scrollLeft > 0);

          if (canScrollX) {
            body.scrollLeft += e.deltaY;
            e.preventDefault();
            e.stopPropagation();
            return;
          }
        }
      }

      const canScrollY =
        (e.deltaY > 0 && body.scrollTop + body.clientHeight < body.scrollHeight) ||
        (e.deltaY < 0 && body.scrollTop > 0);

      if (canScrollY) {
        body.scrollTop += e.deltaY;
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      e.preventDefault();
    };

    overlay.addEventListener("wheel", handleWheel, { passive: false });
    return () => overlay.removeEventListener("wheel", handleWheel);
  }, [section21ModalOpen]);

  // intro-modal Zone A 휠 스크롤 활성화 (native listener — passive: false 필수)
  // useModalScroll의 >= absDelta 조건이 휠 끝부분에서 차단하는 문제 우회
  // Zone A에서만 적용: 1920px 이상 환경에서는 등록 안 함
  useEffect(() => {
    if (!introModalOpen) return;

    const isZoneAViewport =
      window.innerWidth < 1920 ||
      (window.innerWidth >= 1920 && window.innerWidth < 2560 && window.innerHeight >= 1200);
    if (!isZoneAViewport) return;

    const overlay = introOverlayRef.current;
    if (!overlay) return;

    const handleWheel = (e: WheelEvent) => {
      const body = overlay.querySelector(".intro-modal-body") as HTMLElement | null;
      if (!body) {
        e.preventDefault();
        return;
      }

      // 휠 target이 body 바깥이면 차단 (모달 외부 스크롤 방지)
      if (!body.contains(e.target as Node)) {
        e.preventDefault();
        return;
      }

      // body 끝 도달 여부 판단 — useModalScroll보다 너그러운 조건 (>= absDelta가 아닌 > 0)
      const remainingDown = body.scrollHeight - body.clientHeight - body.scrollTop;
      const remainingUp = body.scrollTop;
      const canScrollDown = e.deltaY > 0 && remainingDown > 0;
      const canScrollUp = e.deltaY < 0 && remainingUp > 0;

      if (canScrollDown || canScrollUp) {
        // body가 직접 스크롤하도록 + 글로벌 useModalScroll 가드 차단
        body.scrollTop += e.deltaY;
        e.stopPropagation();
        e.preventDefault();
      } else {
        // 끝 도달 시 페이지 스크롤 방지
        e.preventDefault();
      }
    };

    overlay.addEventListener("wheel", handleWheel, { passive: false });
    return () => overlay.removeEventListener("wheel", handleWheel);
  }, [introModalOpen]);

  const [reviewLinks, setReviewLinks] = useState<string[]>([
    "", // Total Complete (cluving_review_link)
    "", // 3 weeks
    "", // 6 weeks
    "", // 9 weeks
    "", // 12 weeks
    "", // 15 weeks
    "", // 18 weeks
    "", // 21 weeks
    "", // 24 weeks
    "", // 27 weeks
  ]);
  const [editingReviewLinks, setEditingReviewLinks] = useState<string[]>(["", "", "", "", "", "", "", "", "", ""]);
  const [reviewLinkSaving, setReviewLinkSaving] = useState(false);
  const [canEditClubReview, setCanEditClubReview] = useState<boolean>(false);

  // 어드민(마더) 계정은 대표학력 변경 / Club Review 편집 권한 자동 부여
  // session.user.isAdmin 플래그가 JWT 쿠키에 아직 반영 안 됐을 수 있어 email로도 직접 판정
  useEffect(() => {
    const isAdmin = session?.user?.isAdmin || isAdminEmail(session?.user?.email);
    if (isAdmin) {
      setCanChangePrimary(true);
      setCanEditClubReview(true);
    }
  }, [session?.user?.isAdmin, session?.user?.email]);

  // dirty 추적: 편집 데이터 변경 감지 (초기 설정 시 skip)
  const introMountRef = useRef(false);

  useEffect(() => {
    if (photos[0] && photos[1] && footerNotice === "error") setFooterNotice("default");
  }, [photos, footerNotice]);
  useEffect(() => {
    if (editingSloganData.slogan1.content && editingSloganData.slogan1.option && editingSloganData.slogan1.rating > 0 && section2FooterNotice === "error") setSection2FooterNotice("default");
  }, [editingSloganData, section2FooterNotice]);
  useEffect(() => {
    if (!introModalOpen || !isEditingIntro) {
      introMountRef.current = false;
      return;
    }
    if (!introMountRef.current) {
      introMountRef.current = true;
      return;
    }
    setIntroDirty(true);
  }, [editingIntroData]);

  // DB에서 리뷰 링크 로드
  const fetchReviewLink = async () => {
    if (isDemoMode) {
      const demoUser = demoLookupName || DEFAULT_DEMO_USER;
      const userData = CLUSTER2_DUMMY_BY_USER[demoUser] || CLUSTER2_DUMMY_BY_USER[DEFAULT_DEMO_USER];
      setReviewLinks((prev) => {
        const newLinks = [...prev];
        newLinks[0] = userData.reviews.cluvingReviewLink;
        userData.reviews.reviewLinks.forEach((link, index) => {
          newLinks[index + 1] = link;
        });
        return newLinks;
      });
      return;
    }
    try {
      const url = urlUserId ? `/api/review-link?userId=${urlUserId}` : "/api/review-link";
      const response = await fetch(url);
      const result = await response.json();

      if (result.success && result.data) {
        if (result.data.cluvingReviewLink) {
          setReviewLinks((prev) => {
            const newLinks = [...prev];
            newLinks[0] = result.data.cluvingReviewLink;
            return newLinks;
          });
        }
      }
    } catch (error) {
      console.error("리뷰 링크 로드 오류:", error);
    }
  };

  // 세션 변경 시 또는 다른 유저 프로필 조회 시 리뷰 링크 로드
  useEffect(() => {
    if (isOwner && session) {
      fetchReviewLink();
    } else if (!isOwner && urlUserId) {
      fetchReviewLink();
    }
  }, [session, isOwner, urlUserId]);

  // DB에서 자기소개서 로드
  const fetchIntroductions = async () => {
    if (isDemoMode) {
      const demoUser = demoLookupName || DEFAULT_DEMO_USER;
      const userData = CLUSTER2_DUMMY_BY_USER[demoUser] || CLUSTER2_DUMMY_BY_USER[DEFAULT_DEMO_USER];
      const dbFieldOrder = ["growthStory", "socialExperience", "careerDirection", "workStyle", "personalStory"] as const;
      setIntroCards((prev) => {
        const newCards = [...prev];
        dbFieldOrder.forEach((dbField, index) => {
          const dbValue = userData.intro[dbField];
          if (dbValue) {
            newCards[index] = {
              ...newCards[index],
              content: dbValue,
            };
          }
        });
        return newCards;
      });
      return;
    }
    try {
      const url = urlUserId ? `/api/introductions?userId=${urlUserId}` : "/api/introductions";
      const response = await fetch(url);
      const result = await response.json();

      if (result.success && result.data) {
        const dbFieldOrder = ["growthStory", "socialExperience", "careerDirection", "workStyle", "personalStory"];

        setIntroCards((prev) => {
          const newCards = [...prev];
          dbFieldOrder.forEach((dbField, index) => {
            const dbValue = result.data[dbField];
            if (dbValue) {
              newCards[index] = {
                ...newCards[index],
                content: dbValue,
              };
            }
          });
          return newCards;
        });
      }
    } catch (error) {
      console.error("자기소개서 로드 오류:", error);
    }
  };

  // 세션 변경 시 또는 다른 유저 프로필 조회 시 자기소개서 로드
  useEffect(() => {
    if (isOwner && session) {
      fetchIntroductions();
    } else if (!isOwner && urlUserId) {
      fetchIntroductions();
    }
  }, [session, isOwner, urlUserId]);

  // 자기소개서 저장
  const handleSaveIntroduction = async (cardIndex: number, content: string) => {
    if (isDemoMode) {
      const newCards = [...introCards];
      newCards[cardIndex] = { ...newCards[cardIndex], content };
      setIntroCards(newCards);
      setIsEditingIntro(false);
      showAlert("저장되었습니다.");
      return;
    }
    const fieldMapping = ["growth_story", "social_experience", "career_direction", "work_style", "personal_story"];
    const field = fieldMapping[cardIndex];

    setIntroSaving(true);
    try {
      const response = await fetch(apiUrl("/api/introductions"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field,
          content,
        }),
      });

      const result = await response.json();
      if (result.success) {
        const newCards = [...introCards];
        newCards[cardIndex] = {
          ...newCards[cardIndex],
          content: content,
        };
        setIntroCards(newCards);
        setIsEditingIntro(false);
        showAlert("저장되었습니다.");
      } else {
        showAlert(result.error || "자기소개서 저장에 실패했습니다.");
      }
    } catch (error) {
      console.error("자기소개서 저장 오류:", error);
      showAlert("자기소개서 저장 중 오류가 발생했습니다.");
    } finally {
      setIntroSaving(false);
    }
  };

  // 리뷰 링크 저장
  const handleSaveReviewLinks = async () => {
    if (!canEditClubReview) {
      showAlert("작성할 수 있는 기간이 아닙니다. 😊");
      return;
    }
    if (isDemoMode) {
      setReviewLinks([...editingReviewLinks]);
      showAlert("저장되었습니다.");
      setSection4ModalOpen(false);
      return;
    }
    setReviewLinkSaving(true);
    try {
      const response = await fetch(apiUrl("/api/review-link"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cluvingReviewLink: editingReviewLinks[0] || null,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setReviewLinks([...editingReviewLinks]);
        showAlert("저장되었습니다.");
        setSection4ModalOpen(false);
      } else {
        showAlert(result.error || "리뷰 링크 저장에 실패했습니다.");
      }
    } catch (error) {
      console.error("리뷰 링크 저장 오류:", error);
      showAlert("리뷰 링크 저장 중 오류가 발생했습니다.");
    } finally {
      setReviewLinkSaving(false);
    }
  };
  // 각 학력 카드별 드롭다운 상태 (eduIndex_fieldName 형태로 관리)
  const [eduDropdowns, setEduDropdowns] = useState<{ [key: string]: boolean }>({});
  // 학교 검색어 상태
  const [schoolSearchQuery, setSchoolSearchQuery] = useState<{ [key: string]: string }>({});
  // 학교 검색 결과 상태 — /api/schools/search 응답 shape.
  //   { id, name, school_name, schoolType, school_type, region } object 배열.
  //   NEIS / 정적 JSON fallback 경로도 동일 shape 으로 통일됨 (route.ts toItem).
  const [schoolSearchResults, setSchoolSearchResults] = useState<{ [key: string]: SchoolSearchItem[] }>({});
  // 학교 검색 로딩 상태
  const [schoolSearchLoading, setSchoolSearchLoading] = useState<{ [key: string]: boolean }>({});
  // 학교 직접 입력 모드
  const [schoolCustomInput, setSchoolCustomInput] = useState<{ [key: string]: boolean }>({});
  // debounce 타이머 ref
  const schoolSearchTimerRef = useRef<{ [key: string]: NodeJS.Timeout }>({});
  // 모달 바디 ref (자동 스크롤용)
  const modalBodyRef = useRef<HTMLDivElement>(null);

  // 드래그 관련 상태
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const cardsRef = useRef<HTMLDivElement>(null);

  // 섹션 5 물결 파동 상태
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const introRef = useRef<HTMLDivElement>(null);
  const videosRef = useRef<HTMLDivElement>(null);
  const rippleIdRef = useRef(0);
  const lastRippleTime = useRef(0);

  // 스크롤 애니메이션 상태
  const [visibleCards, setVisibleCards] = useState<Set<string>>(new Set());
  const cardRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // 링크 없음 툴팁 상태
  const [noLinkTooltip, setNoLinkTooltip] = useState<{ visible: boolean; x: number; y: number }>({ visible: false, x: 0, y: 0 });

  // 드롭다운 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // 클릭한 요소가 드롭다운 내부가 아니면 모든 드롭다운 닫기
      if (!target.closest(".edu-custom-dropdown") && !target.closest(".school-autocomplete")) {
        setEduDropdowns({});
        setSchoolSearchQuery({});
        setSchoolSearchResults({});
        setSchoolCustomInput({});
      }
      // 슬로건 드롭다운 외부 클릭 시 닫기
      if (!target.closest(".slogan-dropdown-wrapper")) {
        setDropdown1Open(false);
        setDropdown2Open(false);
        setDropdown3Open(false);
      }
    };

    // 이벤트 리스너 등록
    document.addEventListener("mousedown", handleClickOutside);

    // cleanup
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // 학교 검색 API 호출 (debounce)
  const handleSchoolSearch = useCallback((key: string, query: string, eduLevel: string) => {
    setSchoolSearchQuery((prev) => ({ ...prev, [key]: query }));

    // 기존 타이머 클리어
    if (schoolSearchTimerRef.current[key]) {
      clearTimeout(schoolSearchTimerRef.current[key]);
    }

    if (query.length < 2) {
      setSchoolSearchResults((prev) => ({ ...prev, [key]: [] }));
      setSchoolSearchLoading((prev) => ({ ...prev, [key]: false }));
      return;
    }

    setSchoolSearchLoading((prev) => ({ ...prev, [key]: true }));

    schoolSearchTimerRef.current[key] = setTimeout(async () => {
      try {
        const res = await fetch(`/api/schools/search?query=${encodeURIComponent(query)}&eduLevel=${encodeURIComponent(eduLevel)}`);
        const data = await res.json();
        if (!data.success) {
          setSchoolSearchResults((prev) => ({ ...prev, [key]: [] }));
          return;
        }

        // API 는 object 배열을 반환하지만 (route.ts toItem),
        // 캐시/구버전 경로로 string 이 섞여 올 가능성 대비 normalize.
        const raw: unknown[] = Array.isArray(data.schools) ? data.schools : [];
        const items: SchoolSearchItem[] = raw.map((entry, idx) => {
          if (typeof entry === "string") {
            const fallbackType = SCHOOL_TYPE_BY_EDU_LEVEL[eduLevel] ?? eduLevel;
            return {
              id: `legacy:${fallbackType}:${entry}:${idx}`,
              name: entry,
              school_name: entry,
              schoolType: fallbackType,
              school_type: fallbackType,
              region: null,
            };
          }
          const e = entry as Partial<SchoolSearchItem> & Record<string, unknown>;
          const display = (typeof e.school_name === "string" ? e.school_name : undefined) ?? (typeof e.name === "string" ? e.name : undefined) ?? "";
          const t = (typeof e.school_type === "string" ? e.school_type : undefined) ?? (typeof e.schoolType === "string" ? e.schoolType : undefined) ?? "";
          return {
            id: typeof e.id === "string" ? e.id : `${t || "unknown"}:${display}:${idx}`,
            name: display,
            school_name: display,
            schoolType: t,
            school_type: t,
            region: typeof e.region === "string" ? e.region : null,
          };
        }).filter((it) => it.school_name.length > 0);

        if (process.env.NODE_ENV !== "production") {
          // 임시 진단 로그: 응답 vs 정규화 결과 비교. 운영 빌드에서는 제거됨.
          console.log("[SchoolAutocomplete] raw schools", data.schools);
          console.log("[SchoolAutocomplete] normalized items", items);
        }

        setSchoolSearchResults((prev) => ({ ...prev, [key]: items }));
      } catch (error) {
        console.error("학교 검색 오류:", error);
        setSchoolSearchResults((prev) => ({ ...prev, [key]: [] }));
      } finally {
        setSchoolSearchLoading((prev) => ({ ...prev, [key]: false }));
      }
    }, 300);
  }, []);

  // 스크롤 애니메이션 - Intersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const cardId = entry.target.getAttribute("data-card-id");
            if (cardId) {
              setVisibleCards((prev) => new Set([...Array.from(prev), cardId]));
            }
          }
        });
      },
      {
        threshold: 0.2,
        rootMargin: "0px 0px -50px 0px",
      },
    );

    Object.values(cardRefs.current).forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  // 모달 열기
  const openModal = (edu: EduData, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEdu(edu);
    setModalOpen(true);
  };

  // 모달 닫기
  const closeModal = () => {
    setModalOpen(false);
    setSelectedEdu(null);
  };

  const handleWithUsClick = () => {
    setIsWiggling(true);
    setTimeout(() => setIsWiggling(false), 1000);
    // 모바일 CTA 성격: 자기소개서 섹션으로 스크롤
    introRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // 드래그 시작
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStartX(e.clientX);
    setDragOffset(0);
  };

  // 드래그 중
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const diff = e.clientX - dragStartX;
    setDragOffset(diff);
  };

  // 드래그 종료
  const handleMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);

    // 드래그 거리에 따라 페이지 변경
    if (dragOffset < -100 && currentPage < eduTotalPages - 1) {
      setCurrentPage(currentPage + 1);
    } else if (dragOffset > 100 && currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
    setDragOffset(0);
  };

  const handleMouseLeave = () => {
    if (isDragging) {
      handleMouseUp();
    }
  };

  // 명언 카드 틸트 효과
  const handleCardTilt = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -6;
    const rotateY = ((x - centerX) / centerX) * 6;

    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.01, 1.01, 1.01)`;
  }, []);

  const handleCardTiltReset = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    card.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)";
  }, []);

  // 섹션 5 물결 파동 핸들러
  const handleIntroMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!introRef.current) return;

    // 카드 영역 위에서는 물결 생성 안함
    const target = e.target as HTMLElement;
    if (target.closest(".intro-card")) return;

    // 쓰로틀링: 150ms 간격으로만 물결 생성
    const now = Date.now();
    if (now - lastRippleTime.current < 150) return;
    lastRippleTime.current = now;

    const rect = introRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newRipple: Ripple = {
      id: rippleIdRef.current++,
      x,
      y,
    };

    setRipples((prev) => [...prev.slice(-5), newRipple]); // 최대 6개만 유지

    // 2초 후 물결 제거
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
    }, 2000);
  }, []);

  return (
    <div className="cluster2-content">
      {/* PROFILE 헤더 */}
      <div className="cluster2-title-wrapper">
        <div className="title-inner">
          <h1 className="cluster2-title-shadow">PROFILE</h1>
          <h1 className="cluster2-title">PROFILE</h1>
        </div>
        {/* 설명 텍스트 */}
        <div className="section1-description">
          <p>이 페이지는 사회로 나아가는 우리의 모습이 등장합니다.</p>
          <p>우리가 어떻게 바라봤던, 나의 모습, 나의 능력, 나의 경험.. 우리는 그때 그 목표에 얼마나 가까이 살고 있나요?</p>
          <p className="small-text">우수하고, 뛰어나고, 멋진 건 아무 짝에도 소용 없습니다. 남들의 시선도 무시하세요! 😊</p>
          <p className="small-text">중요한건, 내가 나답게 세상에 보여질 수 있는지, 그리고 그 모습을 얼마나 후회없이 그려나가고 있는지 입니다.</p>
          <p className="quote-text">&quot;Know thyself&quot;</p>
          <p className="quote-highlight">&quot;너 자신을 알라&quot;</p>
          <p className="quote-author">- 소크라테스 (Socrates) -</p>
        </div>{" "}
        {/* section1-description 닫힘 */}
      </div>{" "}
      {/* cluster2-title-wrapper 닫힘 */}
      {/* 상단 섹션: 연결된 프레임 */}
      <div className="cluster2-top-frame" style={{ position: "relative" }}>
        {/* Floating Icons - PROFILE 영역 우측 하단 */}
        {
          <div
            className="floating-icons"
            style={{
              display: "flex",
              position: "absolute",
              top: "-78px",
              zIndex: 100,
              gap: "15px",
            }}
          >
            <div
              className="edit-icon"
              style={{ cursor: isOwner || isDemoMode ? "pointer" : "not-allowed", opacity: isOwner || isDemoMode ? 1 : 0.4 }}
              onClick={
                isOwner || isDemoMode
                  ? () =>
                      handleEditClick(() => {
                        setInitialPhotos({ main: mainPhoto, sub: [...subPhotos] });
                        // 6-slot: [sidebar, main, sub1, sub2, sub3, sub4]
                        const raw: (string | null)[] = [sidebarPhoto, mainPhoto, ...(subPhotos || [null, null, null, null])];
                        const hasAny = raw.some((p) => p);
                        const openPhotos = hasAny ? (raw.slice(0, 6).concat(Array(Math.max(0, 6 - raw.length)).fill(null)) as (string | null)[]) : [...SECTION1_PHOTO_DEFAULTS.photos];
                        setPhotos(openPhotos);
                        setPhotosSnapshot([...openPhotos]);
                        setSection1ModalOpen(true);
                      })
                  : undefined
              }
            >
              <i className="ti ti-pencil" style={{ fontSize: "16px", color: "#1a1a1a", pointerEvents: "none" }}></i>
            </div>
            <div className="edit-icon search-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <div className="tooltip">등록된 도움말이 없습니다</div>
            </div>
          </div>
        }
        {/* 왼쪽 카드 */}
        <div className="frame-left">
          <h2 className="adventure-title">Adventure With Us</h2>

          {/* 큰 육각형 이미지 4개 */}
          <div className="hexagon-large-row">
            <div className={`hexagon-large-item ${!subPhotos[0] ? "empty" : ""}`} onClick={() => handleSetStarred(0)} style={{ cursor: subPhotos[0] ? "pointer" : "default" }}>
              <div className="hex-large"><img src={subPhotos[0] || "/images/0/3.png"} alt="Joy" fetchPriority="high" decoding="async" /></div>
              <span className="hex-label">Joy</span>
            </div>
            <div className={`hexagon-large-item ${!subPhotos[1] ? "empty" : ""}`} onClick={() => handleSetStarred(1)} style={{ cursor: subPhotos[1] ? "pointer" : "default" }}>
              <div className="hex-large"><img src={subPhotos[1] || "/images/0/4.png"} alt="Blue" fetchPriority="high" decoding="async" /></div>
              <span className="hex-label">Blue</span>
            </div>
            <div className={`hexagon-large-item ${!subPhotos[2] ? "empty" : ""}`} onClick={() => handleSetStarred(2)} style={{ cursor: subPhotos[2] ? "pointer" : "default" }}>
              <div className="hex-large"><img src={subPhotos[2] || "/images/0/5.png"} alt="Passion" fetchPriority="high" decoding="async" /></div>
              <span className="hex-label">Passion</span>
            </div>
            <div className={`hexagon-large-item ${!subPhotos[3] ? "empty" : ""}`} onClick={() => handleSetStarred(3)} style={{ cursor: subPhotos[3] ? "pointer" : "default" }}>
              <div className="hex-large"><img src={subPhotos[3] || "/images/0/6.png"} alt="Moments" fetchPriority="high" decoding="async" /></div>
              <span className="hex-label">Moments</span>
            </div>
          </div>

          <div className="avatar-row">
            <div className="hexagon-stack">
              <div className="hex-avatar">
                <img src="/images/0/cluster 2/image 1.png" alt="" />
              </div>
              <div className="hex-avatar">
                <img src="/images/0/cluster 2/image 2.png" alt="" />
              </div>
              <div className="hex-avatar">
                <img src="/images/0/cluster 2/image 3.png" alt="" />
              </div>
              <div className="hex-avatar">
                <img src="/images/0/cluster 2/image 4.png" alt="" />
              </div>
              <div className="hex-more">25+</div>
            </div>
            <span className="avatar-count">
              999 <span className="joined-text">Cluving Joined</span>
            </span>
          </div>
        </div>

        {/* 중앙 프로필 사진 */}
        <div className={`frame-center ${!mainPhoto ? "empty" : ""}`}>
          <img src={mainPhoto || "/images/0/2.png"} alt="Profile" />
        </div>

        {/* 오른쪽 카드 */}
        <div className="frame-right">
          <div className="mascot-icon">
            <img
              src={
                isPX
                  ? "/images/0/cluster 2/px 01.png"
                  : isEC
                  ? "/images/0/cluster 2/ec 01.png"
                  : "/images/0/cluster 2/ok 01.png"
              }
              alt=""
            />
            <div className="speech-bubble">안녕 !</div>
          </div>
          <span className="progress-label">OH, MY DREAM</span>
          <span className="progress-value">99.9%</span>
          <button className={`with-us-btn ${isWiggling ? "wiggle" : ""}`} onClick={handleWithUsClick}>
            <img src="/images/0/cluster 2/button box.png" alt="" />
            <span>WITH ME</span>
          </button>
        </div>
      </div>
      {/* 섹션 2-1: 비디오 섹션 */}
      <div ref={videosRef} className="cluster2-videos" style={{ position: "relative" }}>
        {/* Floating Icons - 로그인한 본인만 표시 */}
        {
          <div className="floating-icons" style={{ display: "flex" }}>
            <div
              className="edit-icon"
              onClick={
                isOwner || isDemoMode
                  ? () =>
                      handleEditClick(() => {
                        setEditingVideoData([...videoData]);
                        setInitialVideoData([...videoData]);
                        setVideoSnapshot([...videoData]);
                        setSection21ModalOpen(true);
                      })
                  : undefined
              }
              style={{ opacity: isOwner || isDemoMode ? 1 : 0.4, cursor: isOwner || isDemoMode ? "pointer" : "not-allowed" }}
            >
              <i className="ti ti-pencil" style={{ fontSize: "16px", color: "#1a1a1a" }}></i>
            </div>
            <div className="edit-icon search-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <div className="tooltip">등록된 도움말이 없습니다</div>
            </div>
          </div>
        }

        <div className="videos-header">
          <h2 className="videos-title">Let Me Speak My Own Vision</h2>
          <div className="btn-wrapper">
            <button className="view-all-btn">View All</button>
          </div>
        </div>

        <div className="videos-grid">
          {videoData.slice(videoPage * VIDEOS_PER_PAGE, (videoPage + 1) * VIDEOS_PER_PAGE).map((video) => (
            <div key={video.id} className={`video-card ${!video.videoUrl ? "empty-placeholder" : "has-video"}`}>
              {video.isBookmarked && (
                <div className="bookmark-flag">
                  <svg width="40" height="50" viewBox="0 0 40 50" fill="none">
                    <path d="M0 0H40V50L20 40L0 50V0Z" fill="#F5A623" />
                  </svg>
                </div>
              )}
              {video.thumbnail === "999" ? (
                <div className="video-thumbnail-999"></div>
              ) : !video.videoUrl ? (
                <div className="video-placeholder">
                  <div className="placeholder-icon">
                    <i className="ti ti-video-plus"></i>
                  </div>
                  <p className="placeholder-text">영상을 추가해주세요</p>
                </div>
              ) : video.thumbnail === "placeholder" ? (
                <div className="video-thumbnail-gradient"></div>
              ) : (
                <img src={video.thumbnail || getYouTubeThumbnail(video.videoUrl)} alt={video.title} className="video-thumbnail-image" />
              )}
              <div className="video-overlay">
                {(video.videoUrl || video.thumbnail === "999") && (
                  <>
                    <div className="video-info-top">
                      <div className="video-info-left">
                        <h3 className="video-title">
                          {video.title.split(" ").map((word, idx) =>
                            idx === 0 ? (
                              <span key={idx} className="highlight-orange">
                                {word}
                              </span>
                            ) : (
                              " " + word
                            ),
                          )}
                        </h3>
                        <span className="video-author">{video.author}</span>
                      </div>
                      <div className="video-info-right">
                        <span className="dot-separator">●</span>
                        <span className="viewers-count">{video.viewers}</span>
                      </div>
                    </div>
                    <div className="play-button" onClick={video.videoUrl ? () => window.open(video.videoUrl, "_blank") : undefined} style={{ cursor: video.videoUrl ? "pointer" : "default" }}>
                      <svg width="90" height="90" viewBox="0 0 90 90" fill="none">
                        <circle cx="45" cy="45" r="40" fill="#FFC300" />
                        <circle cx="45" cy="45" r="30" fill="#FFF" />
                        {video.videoUrl && <path d="M38 30L60 45L38 60V30Z" fill="#FFC300" rx="1" />}
                      </svg>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="videos-navigation">
          <button className="nav-btn nav-prev" disabled={videoPage === 0} onClick={() => setVideoPage((p) => Math.max(0, p - 1))}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M15 18L9 12L15 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button className="nav-btn nav-next" disabled={videoPage >= Math.ceil(videoData.length / VIDEOS_PER_PAGE) - 1} onClick={() => setVideoPage((p) => Math.min(Math.ceil(videoData.length / VIDEOS_PER_PAGE) - 1, p + 1))}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M9 18L15 12L9 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${Math.ceil(videoData.length / VIDEOS_PER_PAGE) > 1 ? ((videoPage + 1) / Math.ceil(videoData.length / VIDEOS_PER_PAGE)) * 100 : 100}%` }}></div>
          </div>
        </div>
      </div>
      {/* 인용문 섹션 */}
      <div className="cluster2-quotes" style={{ position: "relative" }}>
        {/* Floating Icons - 로그인한 본인만 표시 */}
        {
          <div className="floating-icons" style={{ display: "flex" }}>
            <div
              className="edit-icon"
              onClick={
                isOwner || isDemoMode
                  ? () =>
                      handleEditClick(() => {
                        setEditingSloganData(sloganData);
                        setInitialSloganData(sloganData);
                        setSloganSnapshot(sloganData);
                        setSection2FooterNotice("default");
                        setSection2ModalOpen(true);
                      })
                  : undefined
              }
              style={{ opacity: isOwner || isDemoMode ? 1 : 0.4, cursor: isOwner || isDemoMode ? "pointer" : "not-allowed" }}
            >
              <i className="ti ti-pencil" style={{ fontSize: "16px", color: "#1a1a1a" }}></i>
            </div>
            <div className="edit-icon search-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <div className="tooltip">등록된 도움말이 없습니다</div>
            </div>
          </div>
        }
        <div className="quotes-bg-image">
          <img src="/images/0/cluster 2/bg00.png" alt="" />
        </div>
        <div className="quotes-cards">
          <div
            className={`quote-card scroll-animate ${visibleCards.has("quote-1") ? "visible" : ""}`}
            ref={(el) => {
              cardRefs.current["quote-1"] = el;
            }}
            data-card-id="quote-1"
            style={{ transitionDelay: "0ms" }}
          >
            <div className="dotted-navigation">
              <span className="dot active" />
              <span className="dot" />
              <span className="dot" />
            </div>
            <img className="diamond-icon" src="/images/0/cluster 2/icon/diamond.png" alt="" />
            <span className="quote-mark">&quot;</span>
            <div className="quote-body">
              <span className="quote-badge">Per Aspera Ad Astra</span>
              {!sloganData.slogan2.content && <p className="quote-subtext">{SECTION2_SLOGAN_DEFAULTS.slogans[1].content}</p>}
              <p className="quote-text">{sloganData.slogan2.content}</p>
              <div className="quote-footer">
                <div className="quote-author">
                  <img src={subPhotos[0] || "/images/0/cluster 2/이안1.webp"} alt="" />
                  <div className="author-info">
                    <span className="author-name">{sloganAuthorName || "Unknown"}</span>
                    <span className="author-role">{sloganData.slogan2.content ? sloganData.slogan2.option : SECTION2_SLOGAN_DEFAULTS.slogans[1].option}</span>
                  </div>
                </div>
                <div className="quote-score">
                  <span className="score-label">CLOUD SCORE</span>
                  <div className="score-row">
                    <div className="score-star-rating">
                      {[1, 2, 3, 4, 5].map((starIndex) => {
                        const fullValue = starIndex * 2;
                        const halfValue = starIndex * 2 - 1;
                        const currentRating = sloganData.slogan2.content ? sloganData.slogan2.rating : SECTION2_SLOGAN_DEFAULTS.slogans[1].rating;
                        const isHalf = currentRating >= halfValue && currentRating < fullValue;
                        const isFull = currentRating >= fullValue;
                        return (
                          <div key={starIndex} className="star-wrapper">
                            <svg className="star-bg" viewBox="0 0 15 15" fill="none" stroke="#999" strokeWidth="1">
                              <path d="M0 7.5C.99 7.51 1.97 7.32 2.88 6.95C3.8 6.58 4.63 6.02 5.33 5.33C6.02 4.63 6.58 3.8 6.95 2.88C7.32 1.97 7.51.99 7.5 0C7.49.99 7.68 1.97 8.05 2.88C8.42 3.8 8.98 4.63 9.67 5.33C10.37 6.02 11.2 6.58 12.12 6.95C13.03 7.32 14.01 7.51 15 7.5C14.01 7.49 13.03 7.68 12.12 8.05C11.2 8.42 10.37 8.98 9.67 9.67C8.98 10.37 8.42 11.2 8.05 12.12C7.68 13.03 7.49 14.01 7.5 15C7.51 14.01 7.32 13.03 6.95 12.12C6.58 11.2 6.02 10.37 5.33 9.67C4.63 8.98 3.8 8.42 2.88 8.05C1.97 7.68.99 7.49 0 7.5Z" />
                            </svg>
                            {isHalf && (
                              <svg className="star-half-fill" viewBox="0 0 15 15">
                                <defs>
                                  <clipPath id={`scoreHalfClip-2-${starIndex}`}>
                                    <rect x="0" y="0" width="7.5" height="15" />
                                  </clipPath>
                                </defs>
                                <path
                                  d="M0 7.5C.99 7.51 1.97 7.32 2.88 6.95C3.8 6.58 4.63 6.02 5.33 5.33C6.02 4.63 6.58 3.8 6.95 2.88C7.32 1.97 7.51.99 7.5 0C7.49.99 7.68 1.97 8.05 2.88C8.42 3.8 8.98 4.63 9.67 5.33C10.37 6.02 11.2 6.58 12.12 6.95C13.03 7.32 14.01 7.51 15 7.5C14.01 7.49 13.03 7.68 12.12 8.05C11.2 8.42 10.37 8.98 9.67 9.67C8.98 10.37 8.42 11.2 8.05 12.12C7.68 13.03 7.49 14.01 7.5 15C7.51 14.01 7.32 13.03 6.95 12.12C6.58 11.2 6.02 10.37 5.33 9.67C4.63 8.98 3.8 8.42 2.88 8.05C1.97 7.68.99 7.49 0 7.5Z"
                                  fill="#DFF314"
                                  clipPath={`url(#scoreHalfClip-2-${starIndex})`}
                                />
                              </svg>
                            )}
                            {isFull && (
                              <svg className="star-full-fill" viewBox="0 0 15 15" fill="#DFF314">
                                <path d="M0 7.5C.99 7.51 1.97 7.32 2.88 6.95C3.8 6.58 4.63 6.02 5.33 5.33C6.02 4.63 6.58 3.8 6.95 2.88C7.32 1.97 7.51.99 7.5 0C7.49.99 7.68 1.97 8.05 2.88C8.42 3.8 8.98 4.63 9.67 5.33C10.37 6.02 11.2 6.58 12.12 6.95C13.03 7.32 14.01 7.51 15 7.5C14.01 7.49 13.03 7.68 12.12 8.05C11.2 8.42 10.37 8.98 9.67 9.67C8.98 10.37 8.42 11.2 8.05 12.12C7.68 13.03 7.49 14.01 7.5 15C7.51 14.01 7.32 13.03 6.95 12.12C6.58 11.2 6.02 10.37 5.33 9.67C4.63 8.98 3.8 8.42 2.88 8.05C1.97 7.68.99 7.49 0 7.5Z" />
                              </svg>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <span className="score-count">{sloganData.slogan2.content ? sloganData.slogan2.rating : SECTION2_SLOGAN_DEFAULTS.slogans[1].rating} / 10</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            className={`quote-card scroll-animate ${visibleCards.has("quote-2") ? "visible" : ""}`}
            ref={(el) => {
              cardRefs.current["quote-2"] = el;
            }}
            data-card-id="quote-2"
            style={{ transitionDelay: "150ms" }}
          >
            <div className="dotted-navigation">
              <span className="dot" />
              <span className="dot active" />
              <span className="dot" />
            </div>
            <img className="diamond-icon" src="/images/0/cluster 2/icon/diamond.png" alt="" />
            <span className="quote-mark">&quot;</span>
            <div className="quote-body">
              <span className="quote-badge">Per Aspera Ad Astra</span>
              {!sloganData.slogan3.content && <p className="quote-subtext">{SECTION2_SLOGAN_DEFAULTS.slogans[2].content}</p>}
              <p className="quote-text">{sloganData.slogan3.content}</p>
              <div className="quote-footer">
                <div className="quote-author">
                  <img src={subPhotos[2] || "/images/0/cluster 2/이안3.jpg"} alt="" />
                  <div className="author-info">
                    <span className="author-name">{sloganAuthorName || "Unknown"}</span>
                    <span className="author-role">{sloganData.slogan3.content ? sloganData.slogan3.option : SECTION2_SLOGAN_DEFAULTS.slogans[2].option}</span>
                  </div>
                </div>
                <div className="quote-score">
                  <span className="score-label">CLOUD SCORE</span>
                  <div className="score-row">
                    <div className="score-star-rating">
                      {[1, 2, 3, 4, 5].map((starIndex) => {
                        const fullValue = starIndex * 2;
                        const halfValue = starIndex * 2 - 1;
                        const currentRating = sloganData.slogan3.content ? sloganData.slogan3.rating : SECTION2_SLOGAN_DEFAULTS.slogans[2].rating;
                        const isHalf = currentRating >= halfValue && currentRating < fullValue;
                        const isFull = currentRating >= fullValue;
                        return (
                          <div key={starIndex} className="star-wrapper">
                            <svg className="star-bg" viewBox="0 0 15 15" fill="none" stroke="#999" strokeWidth="1">
                              <path d="M0 7.5C.99 7.51 1.97 7.32 2.88 6.95C3.8 6.58 4.63 6.02 5.33 5.33C6.02 4.63 6.58 3.8 6.95 2.88C7.32 1.97 7.51.99 7.5 0C7.49.99 7.68 1.97 8.05 2.88C8.42 3.8 8.98 4.63 9.67 5.33C10.37 6.02 11.2 6.58 12.12 6.95C13.03 7.32 14.01 7.51 15 7.5C14.01 7.49 13.03 7.68 12.12 8.05C11.2 8.42 10.37 8.98 9.67 9.67C8.98 10.37 8.42 11.2 8.05 12.12C7.68 13.03 7.49 14.01 7.5 15C7.51 14.01 7.32 13.03 6.95 12.12C6.58 11.2 6.02 10.37 5.33 9.67C4.63 8.98 3.8 8.42 2.88 8.05C1.97 7.68.99 7.49 0 7.5Z" />
                            </svg>
                            {isHalf && (
                              <svg className="star-half-fill" viewBox="0 0 15 15">
                                <defs>
                                  <clipPath id={`scoreHalfClip-3-${starIndex}`}>
                                    <rect x="0" y="0" width="7.5" height="15" />
                                  </clipPath>
                                </defs>
                                <path
                                  d="M0 7.5C.99 7.51 1.97 7.32 2.88 6.95C3.8 6.58 4.63 6.02 5.33 5.33C6.02 4.63 6.58 3.8 6.95 2.88C7.32 1.97 7.51.99 7.5 0C7.49.99 7.68 1.97 8.05 2.88C8.42 3.8 8.98 4.63 9.67 5.33C10.37 6.02 11.2 6.58 12.12 6.95C13.03 7.32 14.01 7.51 15 7.5C14.01 7.49 13.03 7.68 12.12 8.05C11.2 8.42 10.37 8.98 9.67 9.67C8.98 10.37 8.42 11.2 8.05 12.12C7.68 13.03 7.49 14.01 7.5 15C7.51 14.01 7.32 13.03 6.95 12.12C6.58 11.2 6.02 10.37 5.33 9.67C4.63 8.98 3.8 8.42 2.88 8.05C1.97 7.68.99 7.49 0 7.5Z"
                                  fill="#DFF314"
                                  clipPath={`url(#scoreHalfClip-3-${starIndex})`}
                                />
                              </svg>
                            )}
                            {isFull && (
                              <svg className="star-full-fill" viewBox="0 0 15 15" fill="#DFF314">
                                <path d="M0 7.5C.99 7.51 1.97 7.32 2.88 6.95C3.8 6.58 4.63 6.02 5.33 5.33C6.02 4.63 6.58 3.8 6.95 2.88C7.32 1.97 7.51.99 7.5 0C7.49.99 7.68 1.97 8.05 2.88C8.42 3.8 8.98 4.63 9.67 5.33C10.37 6.02 11.2 6.58 12.12 6.95C13.03 7.32 14.01 7.51 15 7.5C14.01 7.49 13.03 7.68 12.12 8.05C11.2 8.42 10.37 8.98 9.67 9.67C8.98 10.37 8.42 11.2 8.05 12.12C7.68 13.03 7.49 14.01 7.5 15C7.51 14.01 7.32 13.03 6.95 12.12C6.58 11.2 6.02 10.37 5.33 9.67C4.63 8.98 3.8 8.42 2.88 8.05C1.97 7.68.99 7.49 0 7.5Z" />
                              </svg>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <span className="score-count">{sloganData.slogan3.content ? sloganData.slogan3.rating : SECTION2_SLOGAN_DEFAULTS.slogans[2].rating} / 10</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* 학력 섹션 */}
      <div ref={eduContainerRef} className={`cluster2-education${currentPage < eduTotalPages - 1 ? " has-more-right" : ""}${currentPage > 0 ? " has-more-left" : ""}`} style={{ position: "relative" }}>
        {/* Floating Icons - 로그인한 본인만 표시 */}
        {
          <div className="floating-icons" style={{ display: "flex" }}>
            <div
              className="edit-icon"
              onClick={
                isOwner || isDemoMode
                  ? () =>
                      handleEditClick(() => {
                        setEditingEduData([...educationData]);
                        setInitialEduDataSnapshot([...educationData]);
                        setHasEduChanges(false);
                        setSection3ModalOpen(true);
                      })
                  : undefined
              }
              style={{ opacity: isOwner || isDemoMode ? 1 : 0.4, cursor: isOwner || isDemoMode ? "pointer" : "not-allowed" }}
            >
              <i className="ti ti-pencil" style={{ fontSize: "16px", color: "#1a1a1a" }}></i>
            </div>
            <div className="edit-icon search-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <div className="tooltip">등록된 도움말이 없습니다</div>
            </div>
          </div>
        }
        <div className="edu-bg-image">
          <img src="/images/0/cluster 2/bg04.png" alt="" />
        </div>
        <div className="edu-center-line">
          <img src="/images/0/cluster 2/section 03.png" alt="" />
        </div>
        <div
          className="edu-cards-wrapper"
          ref={cardsRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          style={{
            transform: `translateX(calc(-${currentPage * eduSlideWidth}px + ${dragOffset}px))`,
            transition: isDragging ? "none" : "transform 0.4s ease",
            userSelect: "none",
            cursor: isDragging ? "grabbing" : "grab",
          }}
        >
          {/* 대표학력을 맨 앞에 배치하고, 나머지는 입학년도 최신순 정렬 */}
          {[...educationData]
            .sort((a, b) => {
              if (a.isFinal !== b.isFinal) return a.isFinal ? -1 : 1;
              const aDate = parseInt(a.startYear || "0") * 100 + parseInt(a.startMonth || "0");
              const bDate = parseInt(b.startYear || "0") * 100 + parseInt(b.startMonth || "0");
              return bDate - aDate;
            })
            .map((edu, index) => (
              <div className={`edu-card ${edu.isFinal ? "first" : ""}`} key={index}>
                <img className="edu-border-tl" src="/images/0/cluster 2/border.png" alt="" />
                <img className="edu-border-br" src="/images/0/cluster 2/border.png" alt="" />
                <img className="edu-bg-icon" src="/images/0/cluster 2/icon/Success Plan.png" alt="" />
                <div className="edu-header">
                  <h3 className="edu-school">
                    <span className="school-circle"></span>
                    <span className="school-name">{mask.school(edu.school)}</span>
                  </h3>
                </div>
                <ul className="edu-details">
                  <li>
                    <span className="dot">·</span>
                    <span className="label">상태</span>
                    <span className="value">{edu.status}</span>
                  </li>
                  <li>
                    <span className="dot">·</span>
                    <span className="label">계열</span>
                    <span className="value">{edu.category}</span>
                  </li>
                  <li>
                    <span className="dot">·</span>
                    <span className="label">전공 1</span>
                    <span className="value">{mask.major(edu.major1)}</span>
                  </li>
                  <li>
                    <span className="dot">·</span>
                    <span className="label">전공 2</span>
                    <span className="value">{mask.major(edu.major2)}</span>
                  </li>
                  <li>
                    <span className="dot">·</span>
                    <span className="label">전공 3</span>
                    <span className="value">{mask.major(edu.major3)}</span>
                  </li>
                  <li>
                    <span className="dot">·</span>
                    <span className="label">기간</span>
                    <span className="value highlight">
                      {mask.period(edu.period).includes("~ing") ? (
                        <>
                          {mask.period(edu.period).replace("~ing", "")}
                          <span className="ing-highlight">~ing</span>
                        </>
                      ) : (
                        mask.period(edu.period)
                      )}
                    </span>
                  </li>
                  <li>
                    <span className="dot">·</span>
                    <span className="label">성적</span>
                    <span className="value highlight">
                      {edu.gradeMax === "9등급" ? `${mask.gpa(edu.gradeValue)}등급` : edu.gradeMax === "100%" ? `${mask.gpa(edu.gradeValue)}%` : mask.gpa(edu.gradeValue)}
                      {edu.gradeMax !== "기타" && <span className="grade-sub"> / {edu.gradeMax}</span>}
                    </span>
                  </li>
                </ul>
                <div className="edu-footer" onClick={(e) => openModal(edu, e)} onMouseDown={(e) => e.stopPropagation()} onMouseMove={(e) => e.stopPropagation()} onMouseUp={(e) => e.stopPropagation()} style={{ cursor: "pointer" }}>
                  <div className="edu-description">
                    <img className="edu-scroll-icon" src="/images/0/cluster 2/icon/Scroll.png" alt="" />
                    <p className="desc-text">{edu.description.length > 35 ? edu.description.substring(0, 35) + "..." : edu.description}</p>
                    <span className="arrow">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </div>
                </div>
                {edu.isFinal && (
                  <div className="final-badge">
                    <img className="final-star" src="/images/0/cluster 2/icon/trophy.png" alt="" />
                    <div className="final-label">
                      <span>FINAL</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
        </div>
        <div className="edu-pagination">
          <div className="pagination-dots">{eduTotalPages > 1 && Array.from({ length: eduTotalPages }, (_, index) => <button key={index} className={`pagination-dot ${currentPage === index ? "active" : ""}`} onClick={() => setCurrentPage(index)} />)}</div>
        </div>
      </div>
      {/* CLUB REVIEW 배너 */}
      <div className="cluster2-review-banner" style={{ position: "relative" }}>
        {/* Floating Icons - 로그인한 본인만 표시 */}
        {
          <div className="floating-icons" style={{ display: "flex" }}>
            <div
              className="edit-icon"
              onClick={
                isOwner || isDemoMode
                  ? () =>
                      handleEditClick(() => {
                        setEditingReviewLinks([...reviewLinks]);
                        setInitialReviewLinksData([...reviewLinks]);
                        setReviewSnapshot([...reviewLinks]);
                        setSection4ModalOpen(true);
                      })
                  : undefined
              }
              style={{ opacity: isOwner || isDemoMode ? 1 : 0.4, cursor: isOwner || isDemoMode ? "pointer" : "not-allowed" }}
            >
              <i className="ti ti-pencil" style={{ fontSize: "16px", color: "#1a1a1a" }}></i>
            </div>
            <div className="edit-icon search-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <div className="tooltip">등록된 도움말이 없습니다</div>
            </div>
          </div>
        }
        <div className="review-banner-inner">
          <h2 className="review-banner-title-shadow">CLUB REVIEW</h2>
          <h2 className="review-banner-title">CLUB REVIEW</h2>
        </div>
      </div>
      {/* 섹션 4 - Cluving Review */}
      <div className="cluster2-section4" style={{ position: "relative" }}>
        {/* 왼쪽 - 명언 카드 3개 */}
        <div className="section4-left">
          <div className="quote-card-item card-1" onMouseMove={handleCardTilt} onMouseLeave={handleCardTiltReset}>
            <img className="quote-bg" src="/images/0/cluster 2/명언 1-1.png" alt="" />
            <div className="quote-overlay">
              <div className="quote-author-badge">
                <div className="hex-wrapper">
                  <div className="hex-border">
                    <svg viewBox="0 0 89 79" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <polygon points="2,39.5 23.25,2 65.75,2 87,39.5 65.75,77 23.25,77" stroke="#FFF" strokeWidth="2" fill="none" />
                    </svg>
                  </div>
                  <img src="/images/0/cluster 2/명언 1.png" alt="" />
                </div>
                <span>- 인디언 속담 -</span>
              </div>
              <p className="quote-text">&quot;누구나 덮어놓고 &apos;시작&apos; 할 수 있지만, 목표한 바 대로 &apos;마무리&apos; 하는 것은 누구나 할 수 있는 것이 아니다.&quot;</p>
            </div>
          </div>
          <div className="quote-card-item card-2" onMouseMove={handleCardTilt} onMouseLeave={handleCardTiltReset}>
            <img className="quote-bg" src="/images/0/cluster 2/명언 2-1.png" alt="" />
            <div className="quote-overlay">
              <div className="quote-author-badge">
                <div className="hex-wrapper">
                  <div className="hex-border">
                    <svg viewBox="0 0 89 79" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <polygon points="2,39.5 23.25,2 65.75,2 87,39.5 65.75,77 23.25,77" stroke="#FFF" strokeWidth="2" fill="none" />
                    </svg>
                  </div>
                  <img src="/images/0/cluster 2/명언 2.png" alt="" />
                </div>
                <span>- 노자 -</span>
              </div>
              <p className="quote-text">&quot;끝을 맺기를 처음과 같이 하면 실패가 없다&quot;</p>
            </div>
          </div>
          <div className="quote-card-item card-3" onMouseMove={handleCardTilt} onMouseLeave={handleCardTiltReset}>
            <img className="quote-bg" src="/images/0/cluster 2/명언 3-1.png" alt="" />
            <div className="quote-overlay">
              <div className="quote-author-badge">
                <div className="hex-wrapper">
                  <div className="hex-border">
                    <svg viewBox="0 0 89 79" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <polygon points="2,39.5 23.25,2 65.75,2 87,39.5 65.75,77 23.25,77" stroke="#FFF" strokeWidth="2" fill="none" />
                    </svg>
                  </div>
                  <img src="/images/0/cluster 2/명언 3.png" alt="" />
                </div>
                <span>- 로빈 샤르마 -</span>
              </div>
              <p className="quote-text">&quot;강하게 시작하는 건 좋지만, 강하게 마무리하는 건 정말 대단해요&quot;</p>
            </div>
          </div>
        </div>

        {/* 오른쪽 */}
        <div className="section4-right">
          {/* Total Complete 큰 박스 */}
          <div className={`total-complete-box${reviewLinks[0] ? " has-link" : ""}`} style={{ position: "relative" }}>
            {reviewLinks[0] && (
              <div
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  backgroundColor: "rgba(250, 171, 7, 1)",
                  zIndex: 2,
                  boxShadow: "0 0 6px 2px rgba(250, 171, 7, 0.6)",
                }}
              />
            )}
            <img className="border-tl" src="/images/0/cluster 2/border.png" alt="" />
            <img className="border-br" src="/images/0/cluster 2/border.png" alt="" />
            <img className="victory-badge" src="/images/0/cluster 2/icon/medal 30.png" alt="" />
            <div className="complete-text">
              <span className="complete-label">Cluving Review -</span>
              <h2>
                <span className="highlight">T</span>otal <span className="highlight">C</span>omplete
              </h2>
              <button
                className="goto-btn"
                onClick={() => {
                  if (reviewLinks[0]) {
                    window.open(reviewLinks[0], "_blank");
                  } else {
                    showAlert("입력된 링크가 없습니다.");
                  }
                }}
              >
                바로가기 &gt;
              </button>
            </div>
          </div>

          {/* 9개의 작은 박스 그리드 */}
          <div className="review-grid-9">
            {[3, 6, 9, 12, 15, 18, 21, 24, 27].map((weeks, index) => (
              <div key={weeks} className={`review-week-item${reviewLinks[index + 1] ? " has-link" : ""}`} style={{ position: "relative" }}>
                {reviewLinks[index + 1] && (
                  <div
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      backgroundColor: "rgba(250, 171, 7, 1)",
                      zIndex: 2,
                      boxShadow: "0 0 6px 2px rgba(250, 171, 7, 0.6)",
                    }}
                  />
                )}
                <img className="border-br" src="/images/0/cluster 2/border.png" alt="" />
                <img src={`/images/0/cluster 2/icon/medal ${weeks}.png`} alt="" className={`medal-icon${[3, 6, 9, 21].includes(weeks) ? " flip-x" : ""}`} />
                <span className="review-label">Cluving Review -</span>
                <span className="review-weeks">{weeks} weeks</span>
                <button
                  className="review-btn"
                  onClick={() => {
                    if (reviewLinks[index + 1]) {
                      window.open(reviewLinks[index + 1], "_blank");
                    } else {
                      showAlert("입력된 링크가 없습니다.");
                    }
                  }}
                >
                  바로가기 &gt;
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* 자기소개서 섹션 */}
      <div className="cluster2-intro" style={{ position: "relative" }} ref={introRef} onMouseMove={handleIntroMouseMove}>
        {/* Floating Icons - search-icon은 항상 표시 */}
        <div className="floating-icons" style={{ display: "flex" }}>
          <div className="edit-icon search-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2" style={{ width: "16px", height: "16px" }}>
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <div className="tooltip">등록된 도움말이 없습니다</div>
          </div>
        </div>
        {/* 물결 파동 효과 */}
        {ripples.map((ripple) => (
          <div
            key={ripple.id}
            className="ripple-effect"
            style={{
              left: ripple.x,
              top: ripple.y,
            }}
          />
        ))}
        <div className="intro-bg">
          <img src="/images/0/cluster 2/bg05.png" alt="" />
        </div>
        <div className="intro-title-wrapper">
          <h2 className="intro-title-shadow">자기소개서</h2>
          <h2 className="intro-title">자기소개서</h2>
        </div>
        <p className="intro-sub">THIS IS MY LIFE</p>
        <div className="intro-cards">
          <div className="intro-row top-row">
            {introCards.slice(0, 3).map((card, index) => (
              <div
                key={card.id}
                className="intro-card"
                onClick={() => {
                  setSelectedIntroCard(index);
                  setIsEditingIntro(false);
                  setInitialIntroContent(introCards[index].content);
                  setIntroDirty(false);
                  setIntroModalOpen(true);
                }}
                style={{ cursor: "pointer" }}
              >
                <svg className="border-tl" xmlns="http://www.w3.org/2000/svg" width="120" height="127" viewBox="0 0 120 127" fill="none">
                  <path d="M1 125.624V18C1 8.61116 8.61116 1 18 1H118.778" stroke="#FAAB07" strokeWidth="3" strokeLinecap="round" />
                </svg>
                <svg className="border-br" xmlns="http://www.w3.org/2000/svg" width="121" height="104" viewBox="0 0 121 104" fill="none">
                  <path d="M119.18 0.999918V90.345C119.18 96.972 113.807 102.345 107.18 102.345H1.00013" stroke="#FAAB07" strokeWidth="3" strokeLinecap="round" />
                </svg>
                <div className="card-header">
                  <img src={card.icon} alt="" className="card-icon" />
                  <div className="title-row">
                    <h4>{card.title}</h4>
                    <button className="card-arrow" data-tooltip={`${card.title} 자세히 보기`}>
                      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </button>
                  </div>
                  <span className="card-subtitle">{card.subtitle}</span>
                </div>
                <p className="intro-card-content">{truncateByBytes(card.content, 80)}</p>
              </div>
            ))}
          </div>
          <div className="intro-row bottom-row">
            {introCards.slice(3, 5).map((card, index) => (
              <div
                key={card.id}
                className="intro-card"
                onClick={() => {
                  setSelectedIntroCard(index + 3);
                  setIsEditingIntro(false);
                  setInitialIntroContent(introCards[index + 3].content);
                  setIntroDirty(false);
                  setIntroModalOpen(true);
                }}
                style={{ cursor: "pointer" }}
              >
                <svg className="border-tl" xmlns="http://www.w3.org/2000/svg" width="120" height="127" viewBox="0 0 120 127" fill="none">
                  <path d="M1 125.624V18C1 8.61116 8.61116 1 18 1H118.778" stroke="#FAAB07" strokeWidth="3" strokeLinecap="round" />
                </svg>
                <svg className="border-br" xmlns="http://www.w3.org/2000/svg" width="121" height="104" viewBox="0 0 121 104" fill="none">
                  <path d="M119.18 0.999918V90.345C119.18 96.972 113.807 102.345 107.18 102.345H1.00013" stroke="#FAAB07" strokeWidth="3" strokeLinecap="round" />
                </svg>
                <div className="card-header">
                  <img src={card.icon} alt="" className="card-icon" />
                  <div className="title-row">
                    <h4>{card.title}</h4>
                    <button className="card-arrow" data-tooltip={`${card.title} 자세히 보기`}>
                      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </button>
                  </div>
                  <span className="card-subtitle">{card.subtitle}</span>
                </div>
                <p className="intro-card-content">{truncateByBytes(card.content, 80)}</p>
              </div>
            ))}
            <div className="intro-card empty waiting">
              <svg className="border-tl" xmlns="http://www.w3.org/2000/svg" width="120" height="127" viewBox="0 0 120 127" fill="none">
                <path d="M1 125.624V18C1 8.61116 8.61116 1 18 1H118.778" stroke="#FAAB07" strokeWidth="3" strokeLinecap="round" />
              </svg>
              <svg className="border-br" xmlns="http://www.w3.org/2000/svg" width="121" height="104" viewBox="0 0 121 104" fill="none">
                <path d="M119.18 0.999918V90.345C119.18 96.972 113.807 102.345 107.18 102.345H1.00013" stroke="#FAAB07" strokeWidth="3" strokeLinecap="round" />
              </svg>
              <div className="waiting-content">
                <img src="/images/0/cluster 2/icon/waiting icon.png" alt="" className="waiting-icon" />
                <span className="waiting-text">WAITING FOR YOU</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* 학력 상세 모달 - 비고 내용만 표시 */}
      {modalOpen && selectedEdu && (
        <div className="edu-modal-overlay" onClick={closeModal}>
          <div className="edu-modal description-only" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="modal-header">
              <div className="modal-school-info">
                <span style={{ fontSize: "20px" }}>✍️</span>
                <h2>{mask.school(selectedEdu.school)}</h2>
                {selectedEdu.isFinal && <span className="final-tag">FINAL</span>}
              </div>
            </div>
            <div className="modal-body">
              <div className="modal-description">
                <img className="scroll-icon" src="/images/0/cluster 2/icon/Scroll.png" alt="" />
                <p>{selectedEdu.description}</p>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 섹션 1 모달 - 프로필 사진 수정 */}
      {section1ModalOpen && (
        <div className="section1-modal-overlay">
          <div className="modal-scroll-content">
            <div className="section1-modal" onClick={(e) => e.stopPropagation()}>
              <div className="section1-modal-header">
                <button
                  className="modal-close-btn"
                  onClick={async () => {
                    if (isSection1Dirty()) {
                      await showConfirm("입력한 데이터가 저장되지 않았습니다. 종료하시겠습니까?", () => {
                        setPhotos([...photosSnapshot]);
                        setFooterNotice("default");
                        setSection1ModalOpen(false);
                      });
                      return;
                    }
                    setSection1ModalOpen(false);
                  }}
                >
                  <i className="ti ti-x"></i>
                </button>
                <div className="modal-header-top">
                  <img src="/images/0/write.png" alt="write" style={{ width: "72px", height: "72px", objectFit: "contain" }} />
                  <h3>프로필 사진</h3>
                </div>
                <p className="modal-subtitle">나를 어필하는 프로필 사진을 등록해주세요. 총 5개를 업로드할 수 있으며, 정해진 규격이 권장됩니다. 😊</p>
              </div>
              <div className="section1-modal-body">
                <div className="photo-grid">
                  {photos.map((photo, index) => {
                    const slotNumber = index + 1;
                    const isDisabled = !isSlotEnabled(index);

                    return (
                      <div className={`photo-slot ${isDisabled ? "disabled" : ""}`} key={index}>
                        <input
                          type="file"
                          accept="image/*"
                          ref={(el) => {
                            photoFileInputRefs.current[index] = el;
                          }}
                          style={{ display: "none" }}
                          onChange={(e) => handlePhotoFileChange(e, index)}
                        />
                        <div className="photo-slot-label">
                          사진 [{slotNumber}]{slotNumber <= 2 && <span style={{ color: accentInline }}> *</span>}
                        </div>
                        <div className="photo-slot-content">
                          <div
                            className="photo-preview"
                            onClick={() => {
                              if (photo) setPreviewPhoto(photo);
                            }}
                          >
                            {photo ? <img src={photo} alt={`사진 ${slotNumber}`} style={{ cursor: "pointer" }} /> : <i className="ti ti-photo-plus" style={{ fontSize: "32px", color: "rgba(255, 165, 0, 0.5)" }}></i>}
                          </div>
                          <div className="photo-actions">
                            <button
                              className={`photo-action-btn ${isDisabled ? "disabled" : ""}`}
                              onClick={() => {
                                if (!isDisabled) handlePhotoUploadClick(index);
                              }}
                            >
                              <i className="ti ti-upload"></i>
                            </button>
                            <button
                              className={`photo-action-btn ${isDisabled || !photo ? "disabled" : ""}`}
                              onClick={() => {
                                if (!isDisabled && photo) handlePhotoDelete(index);
                              }}
                            >
                              <i className="ti ti-trash"></i>
                            </button>
                            {/* 메인 사진 설정 — 추후 활성화 예정
                          <button
                            className={`photo-action-btn ${isDisabled || !photo ? 'disabled' : ''}`}
                            onClick={() => {
                              if (!isDisabled && photo) {
                                console.log(`사진 ${slotNumber} 메인 설정`);
                              }
                            }}
                          >
                            <i className="ti ti-star-filled"></i>
                          </button>
                          */}
                          </div>
                        </div>
                        {slotNumber === 1 && (
                          <p className="photo-slot-description">
                            사진 [1] 은 커리어레쥬메의 좌측
                            <br />
                            &apos;Identity - Core&apos; 에 삽입되는 대표 이미지입니다.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
                {previewPhoto && (
                  <div className="photo-preview-overlay" onClick={() => setPreviewPhoto(null)}>
                    <div className="photo-preview-modal" onClick={(e) => e.stopPropagation()}>
                      <button className="modal-close-btn" onClick={() => setPreviewPhoto(null)}>
                        <i className="ti ti-x"></i>
                      </button>
                      <img src={previewPhoto} alt="확대 보기" />
                    </div>
                  </div>
                )}
              </div>
              <div className="section1-modal-footer">
                <div className="modal-footer-top">
                  <span className="modal-help-icon" onClick={() => setShowHelpModal(true)}>
                    🔎
                  </span>
                  <div className="modal-footer-right">
                    <button
                      className="modal-cancel-btn"
                      onClick={async () => {
                        if (isSection1Dirty()) {
                          await showConfirm("입력한 데이터가 저장되지 않았습니다. 종료하시겠습니까?", () => {
                            setPhotos([...photosSnapshot]);
                            setFooterNotice("default");
                            setSection1ModalOpen(false);
                          });
                        } else {
                          setSection1ModalOpen(false);
                        }
                      }}
                    >
                      취소
                    </button>
                    <button
                      className="modal-reset-btn"
                      onClick={async () => {
                        await showConfirm("입력한 내용을 초기화하시겠습니까?", () => {
                          setPhotos([...SECTION1_PHOTO_DEFAULTS.photos]);
                          setFooterNotice("default");
                        });
                      }}
                    >
                      초기화
                    </button>
                    <button
                      className="modal-save-btn"
                      onClick={async () => {
                        const missingFields: number[] = [];
                        if (!photos[0]) missingFields.push(0);
                        if (!photos[1]) missingFields.push(1);
                        if (missingFields.length > 0) {
                          setFooterNotice("error");
                          const slots = document.querySelectorAll(".photo-slot");
                          missingFields.forEach((i) => slots[i]?.classList.add("field-missing"));
                          const targetSlot = slots[missingFields[0]];
                          if (targetSlot) targetSlot.scrollIntoView({ behavior: "smooth", block: "center" });
                          setTimeout(() => {
                            missingFields.forEach((i) => slots[i]?.classList.remove("field-missing"));
                          }, 900);
                          return;
                        }
                        await showConfirm("저장하시겠습니까?", () => {
                          handleSavePhotos();
                        });
                      }}
                      disabled={photoSaving || photoLoading}
                    >
                      {photoSaving ? "저장 중..." : "저장"}
                    </button>
                  </div>
                </div>
                <div className="modal-footer-bottom">
                  <p className={`modal-footer-notice ${footerNotice === "error" ? "notice-error" : ""}`}>{footerNotice === "error" ? "필수 사항이 누락되었어요! 확인 부탁드려요! 😊" : "내용을 모두 잘 확인하신 후 저장을 눌러주세요. 😊"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 섹션 2 모달 - 슬로건 편집 */}
      {section2ModalOpen && (
        <div className="section2-modal-overlay">
          <div className="section2-modal" onClick={(e) => e.stopPropagation()}>
            <div className="section2-modal-header">
              <button
                className="modal-close-btn"
                onClick={async () => {
                  if (isSection2Dirty()) {
                    await showConfirm("입력한 데이터가 저장되지 않았습니다. 종료하시겠습니까?", () => {
                      setEditingSloganData({ ...sloganSnapshot });
                      setSection2FooterNotice("default");
                      setSection2ModalOpen(false);
                    });
                    return;
                  }
                  setSection2ModalOpen(false);
                }}
              >
                <i className="ti ti-x"></i>
              </button>
              <div className="modal-header-top">
                <img src="/images/0/write.png" alt="write" style={{ width: "72px", height: "72px", objectFit: "contain" }} />
                <h3>캐치프레이즈/슬로건 작성</h3>
              </div>
              <p className="modal-subtitle">나의 매력과 가치를 드러낼 수 있는 슬로건, 캐치프레이즈를 작성해주세요. 😊 내가 어필하고자 하는 생각, 세상을 보는 관점, 의지, 다짐, 비전 등을 총 3개까지 등록할 수 있습니다.</p>
            </div>
            <div className="section2-modal-body">
              {/* 슬로건 1 */}
              <div className="slogan-edit-item">
                <span className="slogan-label">슬로건 1</span>
                <span style={{ color: accentInline, fontSize: "14px", marginLeft: "4px" }}>*</span>
                <span style={{ fontSize: "17px", color: "#888", marginLeft: "8px", fontWeight: 400 }}>슬로건 1은, 커리어레쥬메 좌측에 보여지는 &apos;Identity-Core&apos; 의 메인 슬로건 자리에 나타납니다.</span>
                <div className="slogan-dropdown-wrapper">
                  <button
                    className="slogan-dropdown-btn"
                    onClick={async () => {
                      setDropdown1Open(!dropdown1Open);
                      setDropdown2Open(false);
                      setDropdown3Open(false);
                    }}
                  >
                    <span>{editingSloganData.slogan1.option}</span>
                    <i className={`ti ti-chevron-down ${dropdown1Open ? "rotate" : ""}`}></i>
                  </button>
                  {dropdown1Open && (
                    <div className="slogan-dropdown-menu">
                      {sloganOptions.map((option) => (
                        <div
                          key={option}
                          className={`dropdown-item ${editingSloganData.slogan1.option === option ? "selected" : ""}`}
                          onClick={() => {
                            setEditingSloganData({
                              ...editingSloganData,
                              slogan1: { ...editingSloganData.slogan1, option },
                            });
                            setDropdown1Open(false);
                          }}
                        >
                          {option}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="slogan-textarea-wrapper">
                  <textarea
                    value={editingSloganData.slogan1.content}
                    onChange={(e) => {
                      if (e.target.value.length <= 86) {
                        setEditingSloganData({
                          ...editingSloganData,
                          slogan1: { ...editingSloganData.slogan1, content: e.target.value },
                        });
                      } else {
                        showAlert("최대 86자까지 입력할 수 있습니다.");
                      }
                    }}
                    maxLength={86}
                    placeholder="슬로건 내용을 입력하세요 (최대 86자)"
                  />
                  <span className="char-count">{editingSloganData.slogan1.content.length.toLocaleString()}/86</span>
                </div>
                <div className="slogan-rating-row">
                  <label className="slogan-rating-label">셀프 이행 평가</label>
                  <div className="slogan-star-rating">
                    {[1, 2, 3, 4, 5].map((starIndex) => {
                      const fullValue = starIndex * 2;
                      const halfValue = starIndex * 2 - 1;
                      const currentRating = editingSloganData.slogan1.rating;
                      const isHalf = currentRating >= halfValue && currentRating < fullValue;
                      const isFull = currentRating >= fullValue;
                      return (
                        <div key={starIndex} className="star-wrapper">
                          <svg className="star-bg" viewBox="0 0 24 24" fill="none" stroke="#FFA500" strokeWidth="2">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                          {isHalf && (
                            <svg className="star-half-fill" viewBox="0 0 24 24">
                              <defs>
                                <clipPath id={`sloganHalfClip-1-${starIndex}`}>
                                  <rect x="0" y="0" width="12" height="24" />
                                </clipPath>
                              </defs>
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="#FFA500" clipPath={`url(#sloganHalfClip-1-${starIndex})`} />
                            </svg>
                          )}
                          {isFull && (
                            <svg className="star-full-fill" viewBox="0 0 24 24" fill="#FFA500">
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                          )}
                          <button
                            className="star-click-area star-click-left"
                            type="button"
                            onClick={() =>
                              setEditingSloganData((prev) => ({
                                ...prev,
                                slogan1: { ...prev.slogan1, rating: halfValue },
                              }))
                            }
                          />
                          <button
                            className="star-click-area star-click-right"
                            type="button"
                            onClick={() =>
                              setEditingSloganData((prev) => ({
                                ...prev,
                                slogan1: { ...prev.slogan1, rating: fullValue },
                              }))
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                  <span className="slogan-rating-value">{editingSloganData.slogan1.rating} / 10</span>
                </div>
              </div>

              {/* 슬로건 2 */}
              <div className="slogan-edit-item">
                <span className="slogan-label">슬로건 2</span>
                <div className="slogan-dropdown-wrapper">
                  <button
                    className="slogan-dropdown-btn"
                    onClick={async () => {
                      setDropdown2Open(!dropdown2Open);
                      setDropdown1Open(false);
                      setDropdown3Open(false);
                    }}
                  >
                    <span>{editingSloganData.slogan2.option}</span>
                    <i className={`ti ti-chevron-down ${dropdown2Open ? "rotate" : ""}`}></i>
                  </button>
                  {dropdown2Open && (
                    <div className="slogan-dropdown-menu">
                      {sloganOptions.map((option) => (
                        <div
                          key={option}
                          className={`dropdown-item ${editingSloganData.slogan2.option === option ? "selected" : ""}`}
                          onClick={() => {
                            setEditingSloganData({
                              ...editingSloganData,
                              slogan2: { ...editingSloganData.slogan2, option },
                            });
                            setDropdown2Open(false);
                          }}
                        >
                          {option}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="slogan-textarea-wrapper">
                  <textarea
                    value={editingSloganData.slogan2.content}
                    onChange={(e) => {
                      if (e.target.value.length <= 86) {
                        setEditingSloganData({
                          ...editingSloganData,
                          slogan2: { ...editingSloganData.slogan2, content: e.target.value },
                        });
                      } else {
                        showAlert("최대 86자까지 입력할 수 있습니다.");
                      }
                    }}
                    maxLength={86}
                    placeholder="슬로건 내용을 입력하세요 (최대 86자)"
                  />
                  <span className="char-count">{editingSloganData.slogan2.content.length.toLocaleString()}/86</span>
                </div>
                <div className="slogan-rating-row">
                  <label className="slogan-rating-label">셀프 이행 평가</label>
                  <div className="slogan-star-rating">
                    {[1, 2, 3, 4, 5].map((starIndex) => {
                      const fullValue = starIndex * 2;
                      const halfValue = starIndex * 2 - 1;
                      const currentRating = editingSloganData.slogan2.rating;
                      const isHalf = currentRating >= halfValue && currentRating < fullValue;
                      const isFull = currentRating >= fullValue;
                      return (
                        <div key={starIndex} className="star-wrapper">
                          <svg className="star-bg" viewBox="0 0 24 24" fill="none" stroke="#FFA500" strokeWidth="2">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                          {isHalf && (
                            <svg className="star-half-fill" viewBox="0 0 24 24">
                              <defs>
                                <clipPath id={`sloganHalfClip-2-${starIndex}`}>
                                  <rect x="0" y="0" width="12" height="24" />
                                </clipPath>
                              </defs>
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="#FFA500" clipPath={`url(#sloganHalfClip-2-${starIndex})`} />
                            </svg>
                          )}
                          {isFull && (
                            <svg className="star-full-fill" viewBox="0 0 24 24" fill="#FFA500">
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                          )}
                          <button
                            className="star-click-area star-click-left"
                            type="button"
                            onClick={() =>
                              setEditingSloganData((prev) => ({
                                ...prev,
                                slogan2: { ...prev.slogan2, rating: halfValue },
                              }))
                            }
                          />
                          <button
                            className="star-click-area star-click-right"
                            type="button"
                            onClick={() =>
                              setEditingSloganData((prev) => ({
                                ...prev,
                                slogan2: { ...prev.slogan2, rating: fullValue },
                              }))
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                  <span className="slogan-rating-value">{editingSloganData.slogan2.rating} / 10</span>
                </div>
              </div>

              {/* 슬로건 3 */}
              <div className="slogan-edit-item">
                <span className="slogan-label">슬로건 3</span>
                <div className="slogan-dropdown-wrapper">
                  <button
                    className="slogan-dropdown-btn"
                    onClick={() => {
                      setDropdown3Open(!dropdown3Open);
                      setDropdown1Open(false);
                      setDropdown2Open(false);
                    }}
                  >
                    <span>{editingSloganData.slogan3.option}</span>
                    <i className={`ti ti-chevron-down ${dropdown3Open ? "rotate" : ""}`}></i>
                  </button>
                  {dropdown3Open && (
                    <div className="slogan-dropdown-menu">
                      {sloganOptions.map((option) => (
                        <div
                          key={option}
                          className={`dropdown-item ${editingSloganData.slogan3.option === option ? "selected" : ""}`}
                          onClick={() => {
                            setEditingSloganData({
                              ...editingSloganData,
                              slogan3: { ...editingSloganData.slogan3, option },
                            });
                            setDropdown3Open(false);
                          }}
                        >
                          {option}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="slogan-textarea-wrapper">
                  <textarea
                    value={editingSloganData.slogan3.content}
                    onChange={(e) => {
                      if (e.target.value.length <= 86) {
                        setEditingSloganData({
                          ...editingSloganData,
                          slogan3: { ...editingSloganData.slogan3, content: e.target.value },
                        });
                      } else {
                        showAlert("최대 86자까지 입력할 수 있습니다.");
                      }
                    }}
                    maxLength={86}
                    placeholder="슬로건 내용을 입력하세요 (최대 86자)"
                  />
                  <span className="char-count">{editingSloganData.slogan3.content.length.toLocaleString()}/86</span>
                </div>
                <div className="slogan-rating-row">
                  <label className="slogan-rating-label">셀프 이행 평가</label>
                  <div className="slogan-star-rating">
                    {[1, 2, 3, 4, 5].map((starIndex) => {
                      const fullValue = starIndex * 2;
                      const halfValue = starIndex * 2 - 1;
                      const currentRating = editingSloganData.slogan3.rating;
                      const isHalf = currentRating >= halfValue && currentRating < fullValue;
                      const isFull = currentRating >= fullValue;
                      return (
                        <div key={starIndex} className="star-wrapper">
                          <svg className="star-bg" viewBox="0 0 24 24" fill="none" stroke="#FFA500" strokeWidth="2">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                          {isHalf && (
                            <svg className="star-half-fill" viewBox="0 0 24 24">
                              <defs>
                                <clipPath id={`sloganHalfClip-3-${starIndex}`}>
                                  <rect x="0" y="0" width="12" height="24" />
                                </clipPath>
                              </defs>
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="#FFA500" clipPath={`url(#sloganHalfClip-3-${starIndex})`} />
                            </svg>
                          )}
                          {isFull && (
                            <svg className="star-full-fill" viewBox="0 0 24 24" fill="#FFA500">
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                          )}
                          <button
                            className="star-click-area star-click-left"
                            type="button"
                            onClick={() =>
                              setEditingSloganData((prev) => ({
                                ...prev,
                                slogan3: { ...prev.slogan3, rating: halfValue },
                              }))
                            }
                          />
                          <button
                            className="star-click-area star-click-right"
                            type="button"
                            onClick={() =>
                              setEditingSloganData((prev) => ({
                                ...prev,
                                slogan3: { ...prev.slogan3, rating: fullValue },
                              }))
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                  <span className="slogan-rating-value">{editingSloganData.slogan3.rating} / 10</span>
                </div>
              </div>
            </div>
            <div className="section2-modal-footer">
              <div className="modal-footer-top">
                <span className="modal-help-icon" onClick={() => setShowHelpModal(true)}>
                  🔎
                </span>
                <div className="modal-footer-right">
                  <button
                    className="modal-cancel-btn"
                    onClick={async () => {
                      if (isSection2Dirty()) {
                        await showConfirm("입력한 데이터가 저장되지 않았습니다. 종료하시겠습니까?", () => {
                          setEditingSloganData({ ...sloganSnapshot });
                          setSection2FooterNotice("default");
                          setSection2ModalOpen(false);
                        });
                      } else {
                        setSection2ModalOpen(false);
                      }
                    }}
                  >
                    취소
                  </button>
                  <button
                    className="modal-reset-btn"
                    onClick={async () => {
                      await showConfirm("입력한 내용을 초기화하시겠습니까?", () => {
                        setEditingSloganData({
                          slogan1: { option: SECTION2_SLOGAN_DEFAULTS.slogans[0].option, content: SECTION2_SLOGAN_DEFAULTS.slogans[0].content, rating: SECTION2_SLOGAN_DEFAULTS.slogans[0].rating },
                          slogan2: { option: SECTION2_SLOGAN_DEFAULTS.slogans[1].option, content: SECTION2_SLOGAN_DEFAULTS.slogans[1].content, rating: SECTION2_SLOGAN_DEFAULTS.slogans[1].rating },
                          slogan3: { option: SECTION2_SLOGAN_DEFAULTS.slogans[2].option, content: SECTION2_SLOGAN_DEFAULTS.slogans[2].content, rating: SECTION2_SLOGAN_DEFAULTS.slogans[2].rating },
                        });
                        setSection2FooterNotice("default");
                      });
                    }}
                  >
                    초기화
                  </button>
                  <button
                    className="modal-save-btn"
                    onClick={async () => {
                      const s1 = editingSloganData.slogan1;
                      const missing: string[] = [];
                      if (!s1.content) missing.push("slogan1-text");
                      if (!s1.option) missing.push("slogan1-dropdown");
                      if (!s1.rating || s1.rating === 0) missing.push("slogan1-rating");
                      if (missing.length > 0) {
                        setSection2FooterNotice("error");
                        const targetEl = document.querySelector(".slogan-edit-item");
                        if (targetEl) {
                          targetEl.classList.add("field-missing");
                          targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
                          setTimeout(() => targetEl.classList.remove("field-missing"), 900);
                        }
                        return;
                      }
                      await showConfirm("저장하시겠습니까?", () => {
                        handleSaveSlogans();
                      });
                    }}
                    disabled={sloganSaving}
                  >
                    {sloganSaving ? "저장 중..." : "저장"}
                  </button>
                </div>
              </div>
              <div className="modal-footer-bottom">
                <p className={`modal-footer-notice ${section2FooterNotice === "error" ? "notice-error" : ""}`}>{section2FooterNotice === "error" ? "필수 사항이 누락되었어요! 확인 부탁드려요! 😊" : "내용을 모두 잘 확인하신 후 저장을 눌러주세요. 😊"}</p>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 섹션 2-1 모달 - 영상 편집 */}
      {section21ModalOpen && (
        <div className="section21-modal-overlay" ref={section21OverlayRef}>
          <div className="modal-scroll-content">
            <div className="section21-modal" onClick={(e) => e.stopPropagation()}>
              <div className="section21-modal-header">
                <button
                  className="modal-close-btn"
                  onClick={async () => {
                    if (isSection21Dirty()) {
                      await showConfirm("입력한 데이터가 저장되지 않았습니다. 종료하시겠습니까?", () => {
                        setEditingVideoData([...videoSnapshot]);
                        setSection21ModalOpen(false);
                      });
                      return;
                    }
                    setSection21ModalOpen(false);
                  }}
                >
                  <i className="ti ti-x"></i>
                </button>
                <div className="modal-header-top">
                  <img src="/images/0/write.png" alt="write" style={{ width: "72px", height: "72px", objectFit: "contain" }} />
                  <h3>프로필 동영상</h3>
                </div>
                <p className="modal-subtitle">나를 나타내거나, 활동했던 영상의 링크를 등록해주세요. 총 3개를 업로드할 수 있으며, 유튜브 링크를 권장합니다. 😊</p>
              </div>
              <div className="section21-modal-body">
                {editingVideoData.map((video, index) => (
                  <div key={video.id} className="video-edit-item">
                    <div className="video-edit-header">
                      <h4>Appealing MV {String(index + 1).padStart(2, "0")}</h4>
                      <div className="bookmark-icon">
                        <i className="ti ti-bookmark-filled"></i>
                      </div>
                    </div>

                    {/* 영상 링크 입력 */}
                    <div className="form-group">
                      <label>영상 링크 (YouTube URL)</label>
                      <input
                        type="url"
                        value={video.videoUrl}
                        onChange={(e) => {
                          const newData = [...editingVideoData];
                          newData[index].videoUrl = e.target.value;
                          // 썸네일 자동 업데이트
                          newData[index].thumbnail = getYouTubeThumbnail(e.target.value);
                          setEditingVideoData(newData);
                        }}
                        placeholder="https://youtu.be/... 또는 https://www.youtube.com/watch?v=..."
                      />
                    </div>

                    {/* 썸네일 미리보기 */}
                    {video.videoUrl && (
                      <div className="thumbnail-preview">
                        <label>썸네일 미리보기</label>
                        <div className="thumbnail-image-wrapper">
                          {getYouTubeThumbnail(video.videoUrl) ? (
                            <img
                              src={getYouTubeThumbnail(video.videoUrl)}
                              alt={`영상 ${index + 1} 썸네일`}
                              onError={(e) => {
                                // 최고 화질이 없으면 기본 화질로 fallback
                                const target = e.target as HTMLImageElement;
                                const videoId = extractYouTubeId(video.videoUrl);
                                if (videoId && !target.src.includes("hqdefault")) {
                                  target.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                                }
                              }}
                            />
                          ) : (
                            <div className="no-thumbnail">유효한 YouTube URL을 입력하세요</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="section21-modal-footer">
                <div className="modal-footer-top">
                  <span className="modal-help-icon" onClick={() => setShowHelpModal(true)}>
                    🔎
                  </span>
                  <div className="modal-footer-right">
                    <button
                      className="modal-cancel-btn"
                      onClick={async () => {
                        if (isSection21Dirty()) {
                          await showConfirm("입력한 데이터가 저장되지 않았습니다. 종료하시겠습니까?", () => {
                            setEditingVideoData([...videoSnapshot]);
                            setSection21ModalOpen(false);
                          });
                        } else {
                          setSection21ModalOpen(false);
                        }
                      }}
                    >
                      취소
                    </button>
                    <button
                      className="modal-reset-btn"
                      onClick={async () => {
                        await showConfirm("입력한 내용을 초기화하시겠습니까?", () => {
                          setEditingVideoData(editingVideoData.map((v) => ({ ...v, videoUrl: "", thumbnail: "" })));
                        });
                      }}
                    >
                      초기화
                    </button>
                    <button
                      className="modal-save-btn"
                      onClick={async () => {
                        await showConfirm("저장하시겠습니까?", () => {
                          handleSaveVideos();
                        });
                      }}
                      disabled={videoSaving}
                    >
                      {videoSaving ? "저장 중..." : "저장"}
                    </button>
                  </div>
                </div>
                <div className="modal-footer-bottom">
                  <p className="modal-footer-notice">내용을 모두 잘 확인하신 후 저장을 눌러주세요. 😊</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 섹션 5 모달 - 자기소개서 카드 상세/편집 */}
      {introModalOpen && selectedIntroCard !== null && (
        <div ref={introOverlayRef} className="intro-modal-overlay">
          <div className="modal-scroll-content">
            <div className="intro-modal" onClick={(e) => e.stopPropagation()}>
              <div className="intro-modal-header">
                <button
                  className="modal-close-btn"
                  onClick={async () => {
                    const hasIntroChanges = isEditingIntro && editingIntroData.content.trim() !== initialIntroContent.trim();
                    if (hasIntroChanges) {
                      await showConfirm("입력한 데이터가 저장되지 않았습니다. 종료하시겠습니까?", () => {
                        setEditingIntroData({ content: initialIntroContent });
                        setIntroDirty(false);
                        setIsEditingIntro(false);
                        setIntroModalOpen(false);
                      });
                      return;
                    }
                    setIsEditingIntro(false);
                    setIntroModalOpen(false);
                  }}
                >
                  <i className="ti ti-x"></i>
                </button>
                <div className="modal-header-top">
                  <img src="/images/0/write.png" alt="write" style={{ width: "72px", height: "72px", objectFit: "contain" }} />
                  <h3>{introCards[selectedIntroCard].title}</h3>
                </div>
                <p className="modal-subtitle">{introComments[introCards[selectedIntroCard].title] || ""}</p>
              </div>
              <div className="intro-modal-body">
                <div className="subtitle-section">
                  <p className="subtitle-text">
                    {introCards[selectedIntroCard].subtitle.replace(" 😊", "")} <span style={{ fontStyle: "normal" }}>😊</span>
                  </p>
                </div>
                <div className="content-section">
                  {isEditingIntro ? (
                    <div className="textarea-wrapper">
                      <textarea
                        className="content-textarea"
                        value={editingIntroData.content}
                        onChange={(e) => {
                          if (e.target.value.length <= 1000) {
                            setEditingIntroData({ ...editingIntroData, content: e.target.value });
                          } else {
                            showAlert("최대 1000자까지 입력할 수 있습니다.");
                          }
                        }}
                        placeholder="내용을 입력하세요 (최대 1,000자)"
                        maxLength={1000}
                      />
                      <span className="char-count">{editingIntroData.content.length.toLocaleString()} / 1,000</span>
                    </div>
                  ) : (
                    <p className="content-text">{introCards[selectedIntroCard].content}</p>
                  )}
                </div>
              </div>
              <div className="intro-modal-footer">
                {isEditingIntro ? (
                  <>
                    <div className="modal-footer-top">
                      <span className="modal-help-icon" onClick={() => setShowHelpModal(true)}>
                        🔎
                      </span>
                      <div className="modal-footer-right">
                        <button
                          className="modal-cancel-btn"
                          onClick={async () => {
                            const isDirty = isEditingIntro && editingIntroData.content !== initialIntroContent;
                            if (isDirty) {
                              await showConfirm("입력한 데이터가 저장되지 않았습니다. 종료하시겠습니까?", () => {
                                setEditingIntroData({ content: initialIntroContent });
                                setIntroDirty(false);
                                setIsEditingIntro(false);
                              });
                            } else {
                              setIsEditingIntro(false);
                            }
                          }}
                        >
                          취소
                        </button>
                        <button
                          className="modal-reset-btn"
                          onClick={async () => {
                            await showConfirm("입력한 내용을 초기화하시겠습니까?", () => {
                              setEditingIntroData({ content: defaultIntroContent });
                            });
                          }}
                        >
                          초기화
                        </button>
                        <button
                          className="modal-save-btn"
                          disabled={introSaving}
                          onClick={async () => {
                            await showConfirm("저장하시겠습니까?", () => {
                              if (selectedIntroCard !== null) {
                                handleSaveIntroduction(selectedIntroCard, editingIntroData.content);
                              }
                            });
                          }}
                        >
                          {introSaving ? "저장 중..." : "저장"}
                        </button>
                      </div>
                    </div>
                    <div className="modal-footer-bottom">
                      <p className="modal-footer-notice">내용을 모두 잘 확인하신 후 저장을 눌러주세요. 😊</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="modal-footer-top" style={{ justifyContent: "flex-end" }}>
                      <div className="modal-footer-right">
                        <button
                          className="modal-save-btn"
                          onClick={() =>
                            handleEditClick(() => {
                              setEditingIntroData({
                                content: introCards[selectedIntroCard].content,
                              });
                              setInitialIntroContent(introCards[selectedIntroCard].content);
                              setIsEditingIntro(true);
                            })
                          }
                        >
                          수정
                        </button>
                      </div>
                    </div>
                    <div className="modal-footer-bottom" style={{ visibility: "hidden" }}>
                      <p className="modal-footer-notice">내용을 모두 잘 확인하신 후 저장을 눌러주세요. 😊</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 섹션 4 모달 - 바로가기 링크 편집 */}
      {section4ModalOpen && (
        <div className="section4-modal-overlay">
          <div className="section4-modal">
            <div className="section4-modal-header">
              <button
                className="modal-close-btn"
                onClick={async () => {
                  if (isSection4Dirty()) {
                    await showConfirm("입력한 데이터가 저장되지 않았습니다. 종료하시겠습니까?", () => {
                      setEditingReviewLinks([...reviewSnapshot]);
                      setSection4ModalOpen(false);
                    });
                    return;
                  }
                  setSection4ModalOpen(false);
                }}
              >
                <i className="ti ti-x"></i>
              </button>
              <div className="modal-header-top">
                <img src="/images/0/write.png" alt="write" style={{ width: "72px", height: "72px", objectFit: "contain" }} />
                <h3>성장 기록 / 리뷰 작성</h3>
              </div>
              <p className="modal-subtitle">
                내가 어떻게 성장해왔는지 돌아보고, 나의 성장 기록을 남겨보세요!
                <br />
                나의 성장 과정을 돌아보고 이전의 나와 지금의 나를 비교해보며 더 좋은 성장의 발판으로 삼아보자구요 😊
              </p>
            </div>
            <div
              className={`section4-modal-body${!canEditClubReview ? " locked" : ""}`}
              onClick={(e) => {
                if (!canEditClubReview) {
                  const target = e.target as HTMLElement;
                  if (target.closest("button")) return;
                  showAlert("작성할 수 있는 기간이 아닙니다. 😊");
                }
              }}
            >
              {reviewPermissions.map((perm, index) => {
                const hasContent = editingReviewLinks[index]?.trim().length > 0;
                const medalWeeks = index === 0 ? 30 : [3, 6, 9, 12, 15, 18, 21, 24, 27][index - 1];
                return (
                  <div key={index} className={`link-edit-item${!perm.isOpen ? " slot-disabled" : ""}${hasContent ? " slot-filled" : ""}`}>
                    <div className="link-item-header">
                      <img src={`/images/0/cluster 2/icon/medal ${medalWeeks}.png`} alt="" className="link-medal" />
                      <span className="link-label">{perm.label}</span>
                    </div>
                    <input
                      type="url"
                      placeholder={perm.isOpen ? "링크를 입력하세요 (https://...)" : "비활성화"}
                      value={editingReviewLinks[index]}
                      disabled={!perm.isOpen}
                      onChange={(e) => {
                        if (perm.isOpen) {
                          const newLinks = [...editingReviewLinks];
                          newLinks[index] = e.target.value;
                          setEditingReviewLinks(newLinks);
                        }
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="section4-modal-footer">
              <div className="modal-footer-top">
                <span className="modal-help-icon" onClick={() => setShowHelpModal(true)}>
                  🔎
                </span>
                <div className="modal-footer-right">
                  <button
                    className="modal-cancel-btn"
                    onClick={async () => {
                      if (isSection4Dirty()) {
                        await showConfirm("입력한 데이터가 저장되지 않았습니다. 종료하시겠습니까?", () => {
                          setEditingReviewLinks([...reviewSnapshot]);
                          setSection4ModalOpen(false);
                        });
                      } else {
                        setSection4ModalOpen(false);
                      }
                    }}
                  >
                    취소
                  </button>
                  <button
                    className="modal-reset-btn"
                    onClick={async () => {
                      await showConfirm("입력한 내용을 초기화하시겠습니까?", () => {
                        setEditingReviewLinks(["", "", "", "", "", "", "", "", "", ""]);
                      });
                    }}
                  >
                    초기화
                  </button>
                  <button
                    className="modal-save-btn"
                    onClick={async () => {
                      await showConfirm("저장하시겠습니까?", () => {
                        handleSaveReviewLinks();
                      });
                    }}
                    disabled={reviewLinkSaving || !canEditClubReview}
                    style={!canEditClubReview ? { opacity: 0.3, cursor: "not-allowed" } : {}}
                    title={canEditClubReview ? "저장" : "관리자 승인 필요"}
                  >
                    {reviewLinkSaving ? "저장 중..." : "저장"}
                  </button>
                </div>
              </div>
              <div className="modal-footer-bottom">
                <p className="modal-footer-notice">내용을 모두 잘 확인하신 후 저장을 눌러주세요. 😊</p>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 섹션 3 모달 - 학력 편집 */}
      {section3ModalOpen && (
        <div className="section3-modal-overlay">
          <div className="section3-modal" onClick={(e) => e.stopPropagation()}>
            <div className="section3-modal-header">
              <button
                className="modal-close-btn"
                onClick={async () => {
                  if (isSection3Dirty()) {
                    await showConfirm("입력한 데이터가 저장되지 않았습니다. 종료하시겠습니까?", () => {
                      setEditingEduData([...initialEduDataSnapshot]);
                      setHasEduChanges(false);
                      setEduValidationErrors({});
                      setSection3ModalOpen(false);
                    });
                    return;
                  }
                  setSection3ModalOpen(false);
                }}
              >
                <i className="ti ti-x"></i>
              </button>
              <div className="modal-header-top">
                <img src="/images/0/write.png" alt="write" style={{ width: "72px", height: "72px", objectFit: "contain" }} />
                <h3>학적/학력 사항 작성</h3>
              </div>
              <p className="modal-subtitle">본인의 학적/학력 사항을 입력해주세요! 😊</p>
            </div>
            <div className="section3-modal-body" ref={modalBodyRef}>
              {editingEduData.map((edu, index) => (
                <div
                  key={index}
                  className={`edu-edit-card ${edu.isFinal ? "is-final" : ""} ${index === 0 && !canChangePrimary ? "primary-locked" : ""}`}
                  onClick={(e) => {
                    if (index === 0 && !canChangePrimary) {
                      const target = e.target as HTMLElement;
                      if (target.closest("button")) return;
                      showAlert("작성할 수 있는 기간이 아닙니다. 😊");
                    }
                  }}
                >
                  {/* 헤더: 번호 + 학력 선택 + 대표학력 버튼 */}
                  <div className="edu-edit-header">
                    <span className="edu-edit-number">{index + 1}</span>
                    <div className={`edu-custom-dropdown edu-level-dropdown ${eduDropdowns[`${index}_eduLevel`] ? "open" : ""}`}>
                      <div className="dropdown-selected" onClick={() => setEduDropdowns((prev) => (prev[`${index}_eduLevel`] ? {} : { [`${index}_eduLevel`]: true }))}>
                        <span>{edu.eduLevel || "학력 선택"}</span>
                        <i className="ti ti-chevron-down"></i>
                      </div>
                      {eduDropdowns[`${index}_eduLevel`] && (
                        <div className="dropdown-options">
                          {["-", "대학원", "대학교", "고등학교", "중학교", "초등학교"].map((opt) => (
                            <div
                              key={opt}
                              className={`dropdown-option ${edu.eduLevel === opt ? "selected" : ""}`}
                              onClick={() => {
                                const newData = [...editingEduData];
                                newData[index].eduLevel = opt;
                                newData[index].school = "";
                                setEditingEduData(newData);
                                setEduDropdowns((prev) => ({ ...prev, [`${index}_eduLevel`]: false }));
                              }}
                            >
                              {opt}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="header-buttons">
                      {/* 대표학력 선택 버튼 — 관리자 승인 필요 */}
                      <button
                        className={`final-edu-btn ${edu.isFinal ? "active" : ""}`}
                        disabled={!canChangePrimary}
                        style={!canChangePrimary ? { opacity: 0.3, cursor: "not-allowed" } : {}}
                        onClick={() => {
                          if (!canChangePrimary) return;
                          const newData = editingEduData.map((item, i) => ({
                            ...item,
                            isFinal: i === index,
                          }));
                          // 대표학력을 첫 번째로 이동
                          const finalItem = newData[index];
                          newData.splice(index, 1);
                          newData.unshift(finalItem);
                          setEditingEduData(newData);
                          setTimeout(() => {
                            modalBodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                          }, 100);
                        }}
                        title={canChangePrimary ? "대표학력으로 설정" : "관리자 승인 필요"}
                      >
                        <i className={`ti ${edu.isFinal ? "ti-star-filled" : "ti-star"}`}></i>
                        <span>{edu.isFinal ? "대표학력" : "대표학력 지정"}</span>
                      </button>
                      {/* 삭제 버튼 — 1번 카드는 삭제 불가 */}
                      <button
                        className="delete-edu-btn"
                        disabled={index === 0}
                        style={index === 0 ? { opacity: 0.3, cursor: "not-allowed" } : {}}
                        onClick={async () => {
                          if (index === 0) return;
                          const schoolName = edu.school || `${index + 1}번 학력`;
                          await showConfirm(`${schoolName} 정보를 삭제하시겠습니까?`, () => {
                            const newData = editingEduData.filter((_, i) => i !== index);
                            if (edu.isFinal && newData.length > 0) {
                              newData[0].isFinal = true;
                            }
                            setEditingEduData(newData);
                            setHasEduChanges(true);
                          });
                        }}
                        title="학력 삭제"
                      >
                        <i className="ti ti-trash"></i>
                      </button>
                    </div>
                  </div>

                  {/* 본문 그리드 - 행별로 그룹화 */}
                  <div className="edu-edit-grid">
                    {/* 행 1: 학교 선택 - 자동완성 검색 (전체 너비) */}
                    <div className="edu-edit-row">
                      <div className="edu-edit-field full-width">
                        <label style={eduValidationErrors[`${index}_school`] ? { color: "#ff4444" } : {}}>
                          학교<span style={{ color: accentInline, marginLeft: "2px", fontWeight: 600 }}>*</span>
                        </label>
                        <div className="school-autocomplete">
                          {schoolCustomInput[`${index}_school`] ? (
                            /* 직접 입력 모드 */
                            <div className="school-custom-input-wrapper">
                              <input
                                type="text"
                                className="school-search-input"
                                placeholder="학교명을 직접 입력하세요"
                                value={edu.school || ""}
                                onChange={(e) => {
                                  const newData = [...editingEduData];
                                  newData[index].school = e.target.value;
                                  setEditingEduData(newData);
                                }}
                                autoFocus
                              />
                              <button
                                className="school-back-btn"
                                onClick={() => {
                                  setSchoolCustomInput((prev) => ({ ...prev, [`${index}_school`]: false }));
                                  const newData = [...editingEduData];
                                  newData[index].school = "";
                                  setEditingEduData(newData);
                                }}
                                title="검색으로 돌아가기"
                              >
                                <i className="ti ti-arrow-left"></i>
                              </button>
                            </div>
                          ) : (
                            /* 검색 모드 */
                            <>
                              <div className="school-search-wrapper">
                                <i className="ti ti-search school-search-icon"></i>
                                <input
                                  type="text"
                                  className="school-search-input"
                                  placeholder={edu.eduLevel ? "학교명을 검색하세요 (2글자 이상)" : "학력을 먼저 선택하세요"}
                                  value={edu.school && !eduDropdowns[`${index}_school`] ? edu.school : schoolSearchQuery[`${index}_school`] || ""}
                                  onChange={(e) => {
                                    if (!edu.eduLevel) return;
                                    const newData = [...editingEduData];
                                    newData[index].school = "";
                                    setEditingEduData(newData);
                                    setEduDropdowns((prev) => ({ ...prev, [`${index}_school`]: true }));
                                    handleSchoolSearch(`${index}_school`, e.target.value, edu.eduLevel);
                                  }}
                                  onFocus={() => {
                                    if (!edu.eduLevel) return;
                                    if (edu.school) {
                                      handleSchoolSearch(`${index}_school`, edu.school, edu.eduLevel);
                                    }
                                    setEduDropdowns((prev) => ({ ...prev, [`${index}_school`]: true }));
                                  }}
                                  disabled={!edu.eduLevel}
                                  style={{ opacity: edu.eduLevel ? 1 : 0.5 }}
                                />
                                {edu.school && eduDropdowns[`${index}_school`] !== true && (
                                  <button
                                    className="school-clear-btn"
                                    onClick={() => {
                                      const newData = [...editingEduData];
                                      newData[index].school = "";
                                      setEditingEduData(newData);
                                      setSchoolSearchQuery((prev) => ({ ...prev, [`${index}_school`]: "" }));
                                      setSchoolSearchResults((prev) => ({ ...prev, [`${index}_school`]: [] }));
                                    }}
                                    title="선택 해제"
                                  >
                                    <i className="ti ti-x"></i>
                                  </button>
                                )}
                              </div>
                              {/* 검색 결과 드롭다운 */}
                              {eduDropdowns[`${index}_school`] && edu.eduLevel && (
                                <div className="school-results-dropdown">
                                  {schoolSearchLoading[`${index}_school`] ? (
                                    <div className="school-result-message">
                                      <i className="ti ti-loader school-spinner"></i>
                                      검색 중...
                                    </div>
                                  ) : (schoolSearchQuery[`${index}_school`] || "").length < 2 ? (
                                    <div className="school-result-message">2글자 이상 입력하세요</div>
                                  ) : (schoolSearchResults[`${index}_school`] || []).length === 0 ? (
                                    <div className="school-result-message">검색 결과가 없습니다</div>
                                  ) : (
                                    <div className="school-results-list">
                                      {(schoolSearchResults[`${index}_school`] || []).map((school, schoolIdx) => {
                                        const displayName = getSchoolDisplayName(school);
                                        const key = school.id || `${displayName}-${schoolIdx}`;
                                        return (
                                          <div
                                            key={key}
                                            className={`school-result-item ${edu.school === displayName ? "selected" : ""}`}
                                            onClick={() => {
                                              const newData = [...editingEduData];
                                              newData[index].school = displayName;
                                              setEditingEduData(newData);
                                              setEduDropdowns((prev) => ({ ...prev, [`${index}_school`]: false }));
                                              setSchoolSearchQuery((prev) => ({ ...prev, [`${index}_school`]: "" }));
                                              setSchoolSearchResults((prev) => ({ ...prev, [`${index}_school`]: [] }));
                                            }}
                                          >
                                            {displayName}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                  {/* 기타 (직접 입력) - 하단 고정 */}
                                  <div
                                    className="school-custom-option"
                                    onClick={() => {
                                      setSchoolCustomInput((prev) => ({ ...prev, [`${index}_school`]: true }));
                                      setEduDropdowns((prev) => ({ ...prev, [`${index}_school`]: false }));
                                      setSchoolSearchQuery((prev) => ({ ...prev, [`${index}_school`]: "" }));
                                      setSchoolSearchResults((prev) => ({ ...prev, [`${index}_school`]: [] }));
                                    }}
                                  >
                                    <i className="ti ti-pencil"></i>
                                    기타 (직접 입력)
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 행 2: 상태 */}
                    <div className="edu-edit-row">
                      <div className="edu-edit-field full-width">
                        <label style={eduValidationErrors[`${index}_status`] ? { color: "#ff4444" } : {}}>
                          상태<span style={{ color: accentInline, marginLeft: "2px", fontWeight: 600 }}>*</span>
                        </label>
                        <div className={`edu-custom-dropdown ${eduDropdowns[`${index}_status`] ? "open" : ""}`}>
                          <div className="dropdown-selected" onClick={() => setEduDropdowns((prev) => (prev[`${index}_status`] ? {} : { [`${index}_status`]: true }))}>
                            <span>{edu.status || "선택"}</span>
                            <i className="ti ti-chevron-down"></i>
                          </div>
                          {eduDropdowns[`${index}_status`] && (
                            <div className="dropdown-options">
                              {["-", "재학", "졸업", "졸예", "휴학", "중퇴"].map((opt) => (
                                <div
                                  key={opt}
                                  className={`dropdown-option ${edu.status === opt ? "selected" : ""}`}
                                  onClick={() => {
                                    const newData = [...editingEduData];
                                    newData[index].status = opt;
                                    // 상태 변경 시 졸업시기 관련 값 초기화
                                    if (["재학", "졸예", "휴학", "-"].includes(opt)) {
                                      newData[index].endYear = "";
                                      newData[index].endMonth = "";
                                    } else if (opt === "졸업") {
                                      // 중퇴 텍스트 초기화, 드롭다운용으로 전환
                                      newData[index].endYear = "";
                                      newData[index].endMonth = "";
                                    } else if (opt === "중퇴") {
                                      // 졸업 드롭다운 값 초기화
                                      newData[index].endYear = "";
                                      newData[index].endMonth = "";
                                    }
                                    setEditingEduData(newData);
                                    setEduDropdowns((prev) => ({ ...prev, [`${index}_status`]: false }));
                                  }}
                                >
                                  {opt}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 행 3: 계열 */}
                    <div className="edu-edit-row">
                      <div className="edu-edit-field full-width">
                        <label style={eduValidationErrors[`${index}_category`] ? { color: "#ff4444" } : {}}>
                          계열<span style={{ color: accentInline, marginLeft: "2px", fontWeight: 600 }}>*</span>
                        </label>
                        <div className={`edu-custom-dropdown ${eduDropdowns[`${index}_category`] ? "open" : ""}`}>
                          <div className="dropdown-selected" onClick={() => setEduDropdowns((prev) => (prev[`${index}_category`] ? {} : { [`${index}_category`]: true }))}>
                            <span>{edu.category || "선택"}</span>
                            <i className="ti ti-chevron-down"></i>
                          </div>
                          {eduDropdowns[`${index}_category`] && (
                            <div className="dropdown-options">
                              {["-", "상경", "어문", "인문", "자연", "공학", "예체능", "사회", "기타"].map((opt) => (
                                <div
                                  key={opt}
                                  className={`dropdown-option ${edu.category === opt ? "selected" : ""}`}
                                  onClick={() => {
                                    const newData = [...editingEduData];
                                    newData[index].category = opt;
                                    setEditingEduData(newData);
                                    setEduDropdowns((prev) => ({ ...prev, [`${index}_category`]: false }));
                                  }}
                                >
                                  {opt}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <p className="major-hint">* 계열이 없을 시 &quot;-&quot;를 선택해주세요.</p>
                    </div>

                    {/* 행 4: 전공 1 / 전공 2 / 전공 3 */}
                    <div className="edu-edit-row three-cols">
                      <div className="edu-edit-field">
                        <label style={eduValidationErrors[`${index}_major1`] ? { color: "#ff4444" } : {}}>
                          전공 1<span style={{ color: accentInline, marginLeft: "2px", fontWeight: 600 }}>*</span>
                        </label>
                        <input
                          type="text"
                          value={edu.major1}
                          onChange={(e) => {
                            const newData = [...editingEduData];
                            newData[index].major1 = e.target.value;
                            // 전공1 지우면 전공2, 전공3 초기화
                            if (!e.target.value.trim() || e.target.value.trim() === "-") {
                              newData[index].major2 = "";
                              newData[index].major3 = "";
                            }
                            setEditingEduData(newData);
                          }}
                          placeholder="주전공"
                        />
                      </div>
                      <div className="edu-edit-field">
                        <label>전공 2</label>
                        <input
                          type="text"
                          value={edu.major2}
                          onChange={(e) => {
                            const newData = [...editingEduData];
                            newData[index].major2 = e.target.value;
                            // 전공2 지우면 전공3 초기화
                            if (!e.target.value.trim() || e.target.value.trim() === "-") {
                              newData[index].major3 = "";
                            }
                            setEditingEduData(newData);
                          }}
                          placeholder="복수전공/부전공"
                          disabled={!edu.major1 || !edu.major1.trim() || edu.major1.trim() === "-"}
                          style={!edu.major1 || !edu.major1.trim() || edu.major1.trim() === "-" ? { opacity: 0.4, cursor: "not-allowed", background: "#0d0d0d" } : {}}
                        />
                      </div>
                      <div className="edu-edit-field">
                        <label>전공 3</label>
                        <input
                          type="text"
                          value={edu.major3}
                          onChange={(e) => {
                            const newData = [...editingEduData];
                            newData[index].major3 = e.target.value;
                            setEditingEduData(newData);
                          }}
                          placeholder="기타 전공"
                          disabled={!edu.major2 || !edu.major2.trim() || edu.major2.trim() === "-"}
                          style={!edu.major2 || !edu.major2.trim() || edu.major2.trim() === "-" ? { opacity: 0.4, cursor: "not-allowed", background: "#0d0d0d" } : {}}
                        />
                      </div>
                      <p className="major-hint">* 전공이 없을 시 &quot;-&quot;를 기입해주세요.</p>
                    </div>

                    {/* 행 5: 입학 / 졸업 */}
                    <div className="edu-edit-row">
                      <div className="edu-edit-field">
                        <label style={eduValidationErrors[`${index}_startYear`] || eduValidationErrors[`${index}_startMonth`] ? { color: "#ff4444" } : {}}>
                          입학시기<span style={{ color: accentInline, marginLeft: "2px", fontWeight: 600 }}>*</span>
                        </label>
                        <div className="date-picker-row">
                          <div className={`edu-custom-dropdown small ${eduDropdowns[`${index}_startYear`] ? "open" : ""}`}>
                            <div className="dropdown-selected" onClick={() => setEduDropdowns((prev) => (prev[`${index}_startYear`] ? {} : { [`${index}_startYear`]: true }))}>
                              <span>{edu.startYear || "년도"}</span>
                              <i className="ti ti-chevron-down"></i>
                            </div>
                            {eduDropdowns[`${index}_startYear`] && (
                              <div className="dropdown-options scrollable">
                                {Array.from({ length: 30 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                                  <div
                                    key={year}
                                    className={`dropdown-option ${edu.startYear === String(year) ? "selected" : ""}`}
                                    onClick={() => {
                                      const newData = [...editingEduData];
                                      newData[index].startYear = String(year);
                                      setEditingEduData(newData);
                                      setEduDropdowns((prev) => ({ ...prev, [`${index}_startYear`]: false }));
                                    }}
                                  >
                                    {year}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className={`edu-custom-dropdown small ${eduDropdowns[`${index}_startMonth`] ? "open" : ""}`}>
                            <div className="dropdown-selected" onClick={() => setEduDropdowns((prev) => (prev[`${index}_startMonth`] ? {} : { [`${index}_startMonth`]: true }))}>
                              <span>{edu.startMonth || "월"}</span>
                              <i className="ti ti-chevron-down"></i>
                            </div>
                            {eduDropdowns[`${index}_startMonth`] && (
                              <div className="dropdown-options scrollable">
                                {["03", "09"].map((month) => (
                                  <div
                                    key={month}
                                    className={`dropdown-option ${edu.startMonth === month ? "selected" : ""}`}
                                    onClick={() => {
                                      const newData = [...editingEduData];
                                      newData[index].startMonth = month;
                                      setEditingEduData(newData);
                                      setEduDropdowns((prev) => ({ ...prev, [`${index}_startMonth`]: false }));
                                    }}
                                  >
                                    {month}월
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="edu-edit-field">
                        {edu.status === "중퇴" ? (
                          <>
                            <label style={eduValidationErrors[`${index}_endYear`] ? { color: "#ff4444" } : {}}>
                              중퇴시기<span style={{ color: accentInline, marginLeft: "2px", fontWeight: 600 }}>*</span>
                            </label>
                            <div className="textarea-wrapper">
                              <input
                                type="text"
                                value={edu.endYear || ""}
                                onChange={(e) => {
                                  if (e.target.value.length <= 15) {
                                    const newData = [...editingEduData];
                                    newData[index].endYear = e.target.value;
                                    newData[index].endMonth = "";
                                    setEditingEduData(newData);
                                  }
                                }}
                                maxLength={15}
                                placeholder="중퇴시기 입력 (최대 15자)"
                              />
                              <span className="char-count">{(edu.endYear || "").length}/15</span>
                            </div>
                          </>
                        ) : ["재학", "졸예", "휴학"].includes(edu.status) ? (
                          <>
                            <label>졸업시기</label>
                            <div className="date-picker-row">
                              <div className="edu-custom-dropdown small disabled">
                                <div className="dropdown-selected disabled">
                                  <span className="ing-text">~ing</span>
                                </div>
                              </div>
                            </div>
                          </>
                        ) : edu.status === "졸업" ? (
                          <>
                            <label style={eduValidationErrors[`${index}_endYear`] || eduValidationErrors[`${index}_endMonth`] ? { color: "#ff4444" } : {}}>
                              졸업시기<span style={{ color: accentInline, marginLeft: "2px", fontWeight: 600 }}>*</span>
                            </label>
                            <div className="date-picker-row">
                              <div className={`edu-custom-dropdown small ${eduDropdowns[`${index}_endYear`] ? "open" : ""}`}>
                                <div className="dropdown-selected" onClick={() => setEduDropdowns((prev) => (prev[`${index}_endYear`] ? {} : { [`${index}_endYear`]: true }))}>
                                  <span>{edu.endYear || "년도"}</span>
                                  <i className="ti ti-chevron-down"></i>
                                </div>
                                {eduDropdowns[`${index}_endYear`] && (
                                  <div className="dropdown-options scrollable">
                                    {Array.from({ length: 30 }, (_, i) => 2030 - i).map((year) => (
                                      <div
                                        key={year}
                                        className={`dropdown-option ${edu.endYear === String(year) ? "selected" : ""}`}
                                        onClick={() => {
                                          const newData = [...editingEduData];
                                          newData[index].endYear = String(year);
                                          setEditingEduData(newData);
                                          setEduDropdowns((prev) => ({ ...prev, [`${index}_endYear`]: false }));
                                        }}
                                      >
                                        {year}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className={`edu-custom-dropdown small ${eduDropdowns[`${index}_endMonth`] ? "open" : ""}`}>
                                <div className="dropdown-selected" onClick={() => setEduDropdowns((prev) => (prev[`${index}_endMonth`] ? {} : { [`${index}_endMonth`]: true }))}>
                                  <span>{edu.endMonth || "월"}</span>
                                  <i className="ti ti-chevron-down"></i>
                                </div>
                                {eduDropdowns[`${index}_endMonth`] && (
                                  <div className="dropdown-options scrollable">
                                    {["02", "08"].map((month) => (
                                      <div
                                        key={month}
                                        className={`dropdown-option ${edu.endMonth === month ? "selected" : ""}`}
                                        onClick={() => {
                                          const newData = [...editingEduData];
                                          newData[index].endMonth = month;
                                          setEditingEduData(newData);
                                          setEduDropdowns((prev) => ({ ...prev, [`${index}_endMonth`]: false }));
                                        }}
                                      >
                                        {month}월
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <label>졸업시기</label>
                            <input
                              type="text"
                              value="-"
                              disabled
                              style={{ opacity: 0.6, cursor: "not-allowed", width: "100%", padding: "8px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", fontFamily: '"Pretendard", sans-serif', fontSize: "0.875rem" }}
                            />
                          </>
                        )}
                      </div>
                    </div>

                    {/* 행 6: 성적 (달성치 / 최대치) */}
                    <div className="edu-edit-row grade-row">
                      <div className="edu-edit-field">
                        <label style={eduValidationErrors[`${index}_gradeValue`] ? { color: "#ff4444" } : {}}>
                          성적<span style={{ color: accentInline, marginLeft: "2px", fontWeight: 600 }}>*</span>
                        </label>
                        {/* 최대치에 따라 달성치 입력 방식 변경 */}
                        {edu.gradeMax === "-" ? (
                          // '-' 선택 시: 비활성화된 입력창에 '-' 표시
                          <input type="text" value="-" disabled className="disabled-input" />
                        ) : edu.gradeMax === "4.5" || edu.gradeMax === "4.3" ? (
                          // 4.5 또는 4.3: 정수+소수 드롭다운
                          <div className="grade-dropdown-row">
                            {/* 정수 부분 (0-4) */}
                            <div className={`edu-custom-dropdown grade-int ${eduDropdowns[`${index}_gradeInt`] ? "open" : ""}`}>
                              <div className="dropdown-selected" onClick={() => setEduDropdowns((prev) => (prev[`${index}_gradeInt`] ? {} : { [`${index}_gradeInt`]: true }))}>
                                <span>{edu.gradeValue ? edu.gradeValue.split(".")[0] : "0"}</span>
                                <i className="ti ti-chevron-down"></i>
                              </div>
                              {eduDropdowns[`${index}_gradeInt`] && (
                                <div className="dropdown-options">
                                  {[4, 3, 2, 1, 0].map((num) => (
                                    <div
                                      key={num}
                                      className={`dropdown-option ${edu.gradeValue?.split(".")[0] === String(num) ? "selected" : ""}`}
                                      onClick={() => {
                                        const newData = [...editingEduData];
                                        const currentDecimal = edu.gradeValue?.split(".")[1] || "00";
                                        const newValue = `${num}.${currentDecimal}`;
                                        const maxValue = parseFloat(edu.gradeMax);
                                        // 최대값 체크
                                        if (parseFloat(newValue) <= maxValue) {
                                          newData[index].gradeValue = newValue;
                                        } else {
                                          // 최대값 초과 시 최대값으로 설정
                                          newData[index].gradeValue = edu.gradeMax === "4.5" ? "4.50" : "4.30";
                                        }
                                        setEditingEduData(newData);
                                        setEduDropdowns((prev) => ({ ...prev, [`${index}_gradeInt`]: false }));
                                      }}
                                    >
                                      {num}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <span className="grade-dot">.</span>
                            {/* 소수 부분 (00-99) */}
                            <div className={`edu-custom-dropdown grade-decimal ${eduDropdowns[`${index}_gradeDecimal`] ? "open" : ""}`}>
                              <div className="dropdown-selected" onClick={() => setEduDropdowns((prev) => (prev[`${index}_gradeDecimal`] ? {} : { [`${index}_gradeDecimal`]: true }))}>
                                <span>{edu.gradeValue?.split(".")[1] || "00"}</span>
                                <i className="ti ti-chevron-down"></i>
                              </div>
                              {eduDropdowns[`${index}_gradeDecimal`] && (
                                <div className="dropdown-options">
                                  {Array.from({ length: 100 }, (_, i) => i.toString().padStart(2, "0")).map((num) => {
                                    const intPart = edu.gradeValue?.split(".")[0] || "0";
                                    const testValue = parseFloat(`${intPart}.${num}`);
                                    const maxValue = parseFloat(edu.gradeMax);
                                    const isDisabled = testValue > maxValue;
                                    return (
                                      <div
                                        key={num}
                                        className={`dropdown-option ${edu.gradeValue?.split(".")[1] === num ? "selected" : ""} ${isDisabled ? "disabled" : ""}`}
                                        onClick={() => {
                                          if (isDisabled) return;
                                          const newData = [...editingEduData];
                                          newData[index].gradeValue = `${intPart}.${num}`;
                                          setEditingEduData(newData);
                                          setEduDropdowns((prev) => ({ ...prev, [`${index}_gradeDecimal`]: false }));
                                        }}
                                      >
                                        {num}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : edu.gradeMax === "100%" ? (
                          // 100%: 100~0 드롭다운
                          <div className={`edu-custom-dropdown grade-percent ${eduDropdowns[`${index}_gradePercent`] ? "open" : ""}`}>
                            <div className="dropdown-selected" onClick={() => setEduDropdowns((prev) => (prev[`${index}_gradePercent`] ? {} : { [`${index}_gradePercent`]: true }))}>
                              <span>{edu.gradeValue || "선택"}</span>
                              <i className="ti ti-chevron-down"></i>
                            </div>
                            {eduDropdowns[`${index}_gradePercent`] && (
                              <div className="dropdown-options">
                                {Array.from({ length: 101 }, (_, i) => 100 - i).map((num) => (
                                  <div
                                    key={num}
                                    className={`dropdown-option ${edu.gradeValue === String(num) ? "selected" : ""}`}
                                    onClick={() => {
                                      const newData = [...editingEduData];
                                      newData[index].gradeValue = String(num);
                                      setEditingEduData(newData);
                                      setEduDropdowns((prev) => ({ ...prev, [`${index}_gradePercent`]: false }));
                                    }}
                                  >
                                    {num}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : edu.gradeMax === "9등급" ? (
                          // 9등급: 1~9 드롭다운
                          <div className={`edu-custom-dropdown ${eduDropdowns[`${index}_gradeValue`] ? "open" : ""}`}>
                            <div className="dropdown-selected" onClick={() => setEduDropdowns((prev) => (prev[`${index}_gradeValue`] ? {} : { [`${index}_gradeValue`]: true }))}>
                              <span>{edu.gradeValue === "-" ? "-" : edu.gradeValue ? `${edu.gradeValue}등급` : "성적 선택"}</span>
                              <i className="ti ti-chevron-down"></i>
                            </div>
                            {eduDropdowns[`${index}_gradeValue`] && (
                              <div className="dropdown-options">
                                {["-", ...Array.from({ length: 9 }, (_, i) => i + 1)].map((num) => (
                                  <div
                                    key={num}
                                    className={`dropdown-option ${edu.gradeValue === String(num) ? "selected" : ""}`}
                                    onClick={() => {
                                      const newData = [...editingEduData];
                                      newData[index].gradeValue = String(num);
                                      setEditingEduData(newData);
                                      setEduDropdowns((prev) => ({ ...prev, [`${index}_gradeValue`]: false }));
                                    }}
                                  >
                                    {num === "-" ? "-" : `${num}등급`}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          // 기타 또는 미선택: 직접 입력 (최대 5자)
                          <input
                            type="text"
                            value={edu.gradeValue}
                            onChange={(e) => {
                              if (e.target.value.length <= 5) {
                                const newData = [...editingEduData];
                                newData[index].gradeValue = e.target.value;
                                setEditingEduData(newData);
                              } else {
                                showAlert("최대 5자까지 입력할 수 있습니다.");
                              }
                            }}
                            placeholder="성적 입력 (최대 5자)"
                            maxLength={5}
                          />
                        )}
                      </div>
                      <span className="grade-slash">/</span>
                      <div className="edu-edit-field">
                        <label>&nbsp;</label>
                        {/* 기타 선택 시 직접 입력, 아니면 드롭다운 */}
                        {edu.gradeMax && !["4.5", "4.3", "100%", "9등급", "-"].includes(edu.gradeMax) ? (
                          <div className="grade-max-custom">
                            <input
                              type="text"
                              value={edu.gradeMax === "기타" ? "" : edu.gradeMax}
                              onChange={(e) => {
                                if (e.target.value.length <= 5) {
                                  const newData = [...editingEduData];
                                  newData[index].gradeMax = e.target.value || "기타";
                                  setEditingEduData(newData);
                                } else {
                                  showAlert("최대 5자까지 입력할 수 있습니다.");
                                }
                              }}
                              placeholder="총점 입력 (최대 5자)"
                              maxLength={5}
                            />
                            <button
                              type="button"
                              className="reset-btn"
                              onClick={() => {
                                const newData = [...editingEduData];
                                newData[index].gradeMax = "";
                                newData[index].gradeValue = "";
                                setEditingEduData(newData);
                              }}
                              title="다시 선택"
                            >
                              <i className="ti ti-x"></i>
                            </button>
                          </div>
                        ) : (
                          <div className={`edu-custom-dropdown ${eduDropdowns[`${index}_gradeMax`] ? "open" : ""}`}>
                            <div className="dropdown-selected" onClick={() => setEduDropdowns((prev) => (prev[`${index}_gradeMax`] ? {} : { [`${index}_gradeMax`]: true }))}>
                              <span>{edu.gradeMax || "총점 선택"}</span>
                              <i className="ti ti-chevron-down"></i>
                            </div>
                            {eduDropdowns[`${index}_gradeMax`] && (
                              <div className="dropdown-options">
                                {["-", "4.5", "4.3", "100%", "9등급", "기타"].map((opt) => (
                                  <div
                                    key={opt}
                                    className={`dropdown-option ${edu.gradeMax === opt ? "selected" : ""}`}
                                    onClick={() => {
                                      const newData = [...editingEduData];
                                      newData[index].gradeMax = opt;
                                      // 최대치 변경 시 달성치 초기화 ('-' 선택 시 달성치도 '-')
                                      newData[index].gradeValue = opt === "-" ? "-" : "";
                                      setEditingEduData(newData);
                                      setEduDropdowns((prev) => ({ ...prev, [`${index}_gradeMax`]: false }));
                                    }}
                                  >
                                    {opt}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <p className="major-hint">* 성적이 없을 시 &quot;-&quot;를 선택해주세요.</p>
                    </div>

                    {/* 행 6: 비고 (전체 너비) */}
                    <div className="edu-edit-row">
                      <div className="edu-edit-field full-width">
                        <label style={eduValidationErrors[`${index}_description`] ? { color: "#ff4444" } : {}}>
                          학교 생활<span style={{ color: accentInline, marginLeft: "2px", fontWeight: 600 }}>*</span>
                        </label>
                        <div className="textarea-wrapper">
                          <textarea
                            value={edu.description}
                            onChange={(e) => {
                              if (e.target.value.length <= 200) {
                                const newData = [...editingEduData];
                                newData[index].description = e.target.value;
                                setEditingEduData(newData);
                              } else {
                                showAlert("최대 200자까지 입력할 수 있습니다.");
                              }
                            }}
                            placeholder="학교 생활에 대해 작성해주세요 (최대 200자)"
                            rows={3}
                            maxLength={200}
                          />
                          <span className="char-count">{edu.description.length.toLocaleString()}/200</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {editingEduData.length < 10 && (
                <button
                  className="add-edu-btn"
                  onClick={() => {
                    const newEdu: EduData = {
                      eduLevel: "",
                      school: "",
                      status: "",
                      category: "",
                      major1: "",
                      major2: "",
                      major3: "",
                      period: "",
                      startYear: "",
                      startMonth: "",
                      endYear: "",
                      endMonth: "",
                      gradeMax: "",
                      gradeValue: "",
                      description: "",
                      isFinal: false,
                    };
                    setEditingEduData([...editingEduData, newEdu]);
                    setTimeout(() => {
                      const container = modalBodyRef.current;
                      const cards = container?.querySelectorAll(".edu-edit-card");
                      if (container && cards && cards.length > 0) {
                        const lastCard = cards[cards.length - 1] as HTMLElement;
                        container.scrollTo({ top: lastCard.offsetTop - container.offsetTop, behavior: "smooth" });
                      }
                    }, 100);
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  학력 추가하기
                </button>
              )}
            </div>
            <div className="section3-modal-footer">
              <div className="modal-footer-top">
                <span className="modal-help-icon" onClick={() => setShowHelpModal(true)}>
                  🔎
                </span>
                <div className="modal-footer-right">
                  <button
                    className="modal-cancel-btn"
                    onClick={async () => {
                      if (isSection3Dirty()) {
                        await showConfirm("입력한 데이터가 저장되지 않았습니다. 종료하시겠습니까?", () => {
                          setEditingEduData([...initialEduDataSnapshot]);
                          setHasEduChanges(false);
                          setEduValidationErrors({});
                          setSection3ModalOpen(false);
                        });
                      } else {
                        setSection3ModalOpen(false);
                      }
                    }}
                  >
                    취소
                  </button>
                  <button
                    className="modal-reset-btn"
                    onClick={async () => {
                      await showConfirm("입력한 내용을 초기화하시겠습니까?", () => {
                        setEditingEduData([
                          {
                            eduLevel: "",
                            school: "",
                            status: "",
                            category: "",
                            major1: "",
                            major2: "",
                            major3: "",
                            period: "",
                            startYear: "",
                            startMonth: "",
                            endYear: "",
                            endMonth: "",
                            gradeMax: "",
                            gradeValue: "",
                            description: "",
                            isFinal: true,
                          },
                        ]);
                        setHasEduChanges(false);
                        setEduValidationErrors({});
                        setSection3FooterNotice("default");
                      });
                    }}
                  >
                    초기화
                  </button>
                  <button
                    className="modal-save-btn"
                    disabled={eduSaving}
                    onClick={async () => {
                      // 모든 카드 필수필드 검증
                      const newErrors: { [key: string]: boolean } = {};
                      editingEduData.forEach((edu, idx) => {
                        // 1번 카드는 canChangePrimary=true일 때만 체크
                        if (idx === 0 && !canChangePrimary) return;

                        if (!edu.school || edu.school === "-") newErrors[`${idx}_school`] = true;
                        if (!edu.status || edu.status === "-") newErrors[`${idx}_status`] = true;
                        if (!edu.category || edu.category === "-") newErrors[`${idx}_category`] = true;
                        if (!edu.major1 || edu.major1 === "-") newErrors[`${idx}_major1`] = true;
                        if (!edu.startYear) newErrors[`${idx}_startYear`] = true;
                        if (edu.startYear && !edu.startMonth) newErrors[`${idx}_startMonth`] = true;
                        if (!edu.gradeValue || edu.gradeValue === "-") newErrors[`${idx}_gradeValue`] = true;
                        if (!edu.description || edu.description.trim() === "") newErrors[`${idx}_description`] = true;
                        if (edu.status === "졸업") {
                          if (!edu.endYear) newErrors[`${idx}_endYear`] = true;
                          if (edu.endYear && !edu.endMonth) newErrors[`${idx}_endMonth`] = true;
                        }
                        if (edu.status === "중퇴") {
                          if (!edu.endYear || edu.endYear.trim() === "") newErrors[`${idx}_endYear`] = true;
                        }
                      });

                      setEduValidationErrors(newErrors);

                      if (Object.keys(newErrors).length > 0) {
                        setSection3FooterNotice("error");
                        setTimeout(() => {
                          const container = modalBodyRef.current;
                          if (!container) return;
                          const cards = container.querySelectorAll(".edu-edit-card");
                          // 첫 번째 에러가 있는 카드 찾기
                          const firstErrorKey = Object.keys(newErrors)[0];
                          const firstCardIdx = parseInt(firstErrorKey.split("_")[0]);
                          const targetCard = cards[firstCardIdx] as HTMLElement;
                          if (!targetCard) return;
                          const labels = targetCard.querySelectorAll(".edu-edit-field label");
                          let targetField: HTMLElement | null = null;
                          for (let i = 0; i < labels.length; i++) {
                            if ((labels[i] as HTMLElement).style.color === "rgb(255, 68, 68)") {
                              targetField = (labels[i] as HTMLElement).closest(".edu-edit-field") as HTMLElement;
                              break;
                            }
                          }
                          if (targetField) {
                            targetField.classList.add("field-missing");
                            container.scrollTop = targetField.offsetTop - container.offsetTop;
                            setTimeout(() => targetField?.classList.remove("field-missing"), 900);
                          } else {
                            container.scrollTop = targetCard.offsetTop - container.offsetTop;
                          }
                        }, 100);
                        return;
                      }

                      await showConfirm("저장하시겠습니까?", () => {
                        const processedData = editingEduData.map((edu) => {
                          const startStr = edu.startYear && edu.startMonth ? `${edu.startYear}.${edu.startMonth}` : edu.startYear || "";
                          const endStr = edu.endYear && edu.endMonth ? `${edu.endYear}.${edu.endMonth}` : edu.endYear || "";
                          const isOngoing = ["재학", "졸예", "졸업예정", "휴학"].includes(edu.status);

                          let period = "";
                          if (startStr) {
                            if (isOngoing) {
                              period = `${startStr} - ~ing`;
                            } else if (endStr) {
                              period = `${startStr} - ${endStr}`;
                            } else {
                              period = `${startStr} -`;
                            }
                          }

                          return {
                            ...edu,
                            period,
                            major1: edu.major1.trim() === "" ? "-" : edu.major1,
                            major2: edu.major2.trim() === "" ? "-" : edu.major2,
                            major3: edu.major3.trim() === "" ? "-" : edu.major3,
                          };
                        });
                        // 정렬: 1번(대표학력) 고정 + 2번부터 입학시기 최신순
                        const primaryCard = processedData[0];
                        const otherCards = processedData.slice(1).sort((a, b) => {
                          const yearA = parseInt(a.startYear || "0") || 0;
                          const yearB = parseInt(b.startYear || "0") || 0;
                          if (yearA !== yearB) return yearB - yearA;
                          const monthA = parseInt(a.startMonth || "0") || 0;
                          const monthB = parseInt(b.startMonth || "0") || 0;
                          return monthB - monthA;
                        });
                        const sortedData = [primaryCard, ...otherCards];
                        handleSaveEducations(sortedData);
                      });
                    }}
                  >
                    {eduSaving ? "저장 중..." : "저장"}
                  </button>
                </div>
              </div>
              <div className="modal-footer-bottom">
                <p className={`modal-footer-notice ${section3FooterNotice === "error" ? "notice-error" : ""}`}>{section3FooterNotice === "error" ? "필수 사항이 누락되었어요! 확인 부탁드려요! 😊" : "내용을 모두 잘 확인하신 후 저장을 눌러주세요. 😊"}</p>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 도움말 모달 */}
      {showHelpModal && (
        <div className="help-modal-overlay" onClick={() => setShowHelpModal(false)}>
          <div className="help-modal" onClick={(e) => e.stopPropagation()}>
            <div className="help-modal-header">
              <div className="modal-header-top">
                <span style={{ fontSize: "20px" }}>🔎</span>
                <h3>도움말</h3>
                <button className="modal-close-btn" onClick={() => setShowHelpModal(false)}>
                  <i className="ti ti-x"></i>
                </button>
              </div>
            </div>
            <div className="help-modal-body">{/* 빈 콘텐츠 — 추후 추가 */}</div>
          </div>
        </div>
      )}
      {/* 링크 없음 툴팁 */}
      {noLinkTooltip.visible && (
        <div
          style={{
            position: "fixed",
            left: noLinkTooltip.x + 10,
            top: noLinkTooltip.y - 30,
            background: "rgba(30, 32, 40, 0.95)",
            color: "#fff",
            padding: "8px 12px",
            borderRadius: "6px",
            fontSize: "13px",
            fontFamily: "Pretendard, sans-serif",
            zIndex: 10000,
            pointerEvents: "none",
            whiteSpace: "nowrap",
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          }}
        >
          리뷰 링크 등록이 필요합니다.
        </div>
      )}
    </div>
  );
};

export default Cluster2Content;
