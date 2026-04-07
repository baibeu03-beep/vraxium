// [LEGACY STUB] 원본은 _legacy/lib/supabase.ts 로 격리됨.
//
// 사유:
//   - 5개 컴포넌트가 `import { supabase } from '@/lib/supabase'` 로 직접 쿼리 중
//   - 컴포넌트(퍼블리싱 코드) 30+ 호출처를 일일이 주석 처리하는 대신
//     체이닝 + await 호환 stub으로 빌드를 통과시킴
//   - 새 백엔드 레이어 구축 시 이 파일을 통째로 교체할 것
//
// 동작:
//   - `.from(...).select(...).eq(...).maybeSingle()` 등 임의 체이닝 허용
//   - `await` 시 항상 `{ data: null, error: null }` 반환
//   - 어떤 메서드도 throw 하지 않음
//   - 컴포넌트 동작은 "데이터가 없는 상태"와 동일하게 됨 (런타임 안전, 빈 화면)

function createChainableStub(): any {
  const handler: ProxyHandler<any> = {
    get(_target, prop) {
      // await 시 then이 호출됨 → 즉시 resolve
      if (prop === 'then') {
        return (resolve: (value: { data: null; error: null }) => void) => {
          resolve({ data: null, error: null });
        };
      }
      // 그 외 모든 프로퍼티 접근은 다시 체이닝 가능한 stub 반환
      return createChainableStub();
    },
    apply() {
      // 함수 호출 (.from(...), .select(...) 등)도 다시 체이닝 가능한 stub 반환
      return createChainableStub();
    },
  };
  return new Proxy(function noop() {}, handler);
}

const stub: any = createChainableStub();

export const supabase: any = stub;
export const supabaseAdmin: any = stub;
