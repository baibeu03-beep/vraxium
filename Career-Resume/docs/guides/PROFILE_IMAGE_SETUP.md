# 프로필 이미지 설정 가이드

## Supabase Storage 설정

### 1. Supabase 대시보드에서 Storage 버킷 생성

1. Supabase 대시보드 접속
2. **Storage** 메뉴 클릭
3. **New Bucket** 버튼 클릭
4. 버킷 이름: `profile-images`
5. **Public bucket** 체크 (공개 이미지이므로)
6. **Create bucket** 클릭

### 2. 정책 설정 (Policy)

버킷 생성 후 정책 설정:

```sql
-- 모두가 이미지를 읽을 수 있도록 설정
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-images');

-- 인증된 사용자만 업로드 가능 (선택사항)
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'profile-images' AND auth.role() = 'authenticated');
```

### 3. 이미지 업로드

#### 방법 A: 대시보드에서 수동 업로드
1. Storage > profile-images 버킷 클릭
2. **Upload file** 버튼
3. 이미지 선택 후 업로드
4. 업로드된 이미지의 URL 복사

#### 방법 B: 코드로 업로드
```typescript
const uploadProfileImage = async (file: File, userId: string) => {
  const fileExt = file.name.split('.').pop()
  const fileName = `${userId}.${fileExt}`

  const { data, error } = await supabase.storage
    .from('profile-images')
    .upload(fileName, file, {
      upsert: true // 같은 이름이면 덮어쓰기
    })

  if (error) {
    console.error('Upload error:', error)
    return null
  }

  // Public URL 생성
  const { data: { publicUrl } } = supabase.storage
    .from('profile-images')
    .getPublicUrl(fileName)

  return publicUrl
}
```

### 4. DB에 URL 저장

이미지를 업로드한 후, URL을 `user_profiles` 테이블의 `profile_photo_url`에 저장:

```sql
UPDATE user_profiles
SET profile_photo_url = 'https://otaoevvpavpkohdkmtre.supabase.co/storage/v1/object/public/profile-images/USER_ID.jpg'
WHERE id = 'USER_ID';
```

### 5. 기본 이미지 설정

프로필 이미지가 없는 경우를 위해 기본 이미지 준비:

1. `public/images/default-profile.png` 파일 준비
2. Sidebar 컴포넌트에서 기본 이미지 사용

---

## 빠른 시작 (임시 방법)

현재 상태에서 바로 테스트하려면:

1. 현재 있는 이미지 사용:
   ```
   /images/0/iZKpm7I6mM-X1RCe8whJEe_K4L1q7r24whHrO5pK6vLZ1ivZs-sMvk3r35n6xbZ5P3Y8updzx8RXuoYL_5-GCQ.webp
   ```

2. DB에 임시로 저장:
   ```sql
   UPDATE user_profiles
   SET profile_photo_url = '/images/0/iZKpm7I6mM-X1RCe8whJEe_K4L1q7r24whHrO5pK6vLZ1ivZs-sMvk3r35n6xbZ5P3Y8updzx8RXuoYL_5-GCQ.webp'
   WHERE id = '054bd63d-d6b4-434c-a40d-06521b9c2a95';
   ```

---

## 이미지 URL 형식

### Supabase Storage URL 형식:
```
https://[PROJECT_ID].supabase.co/storage/v1/object/public/[BUCKET_NAME]/[FILE_PATH]
```

### 예시:
```
https://otaoevvpavpkohdkmtre.supabase.co/storage/v1/object/public/profile-images/054bd63d-d6b4-434c-a40d-06521b9c2a95.jpg
```

### 로컬 public 폴더:
```
/images/profiles/user1.jpg
```