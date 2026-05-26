"use client";
import Image from "next/image";
import { useEffect, useState } from "react";

const Sidebar = () => {
  const [stat1, setStat1] = useState(0);
  const [stat2, setStat2] = useState(0);
  const [badge1, setBadge1] = useState(0);
  const [badge2, setBadge2] = useState(0);
  const [badge3, setBadge3] = useState(0);
  const [skill1, setSkill1] = useState(0);
  const [skill2, setSkill2] = useState(0);
  const [skill3, setSkill3] = useState(0);
  const [skill4, setSkill4] = useState(0);

  useEffect(() => {
    const animateNumber = (setter: (val: number) => void, target: number, duration: number = 2000) => {
      const steps = 60;
      const increment = target / steps;
      let current = 0;
      let step = 0;

      const timer = setInterval(() => {
        step++;
        current += increment;

        if (step >= steps) {
          setter(target);
          clearInterval(timer);
        } else {
          setter(Math.floor(current));
        }
      }, duration / steps);

      return timer;
    };

    const timers = [
      animateNumber(setStat1, 100, 1500),
      animateNumber(setStat2, 80, 1500),
      animateNumber(setBadge1, 99999, 1500),
      animateNumber(setBadge2, 99999, 1500),
      animateNumber(setBadge3, -9999, 1500),
      animateNumber(setSkill1, 21, 1500),
      animateNumber(setSkill2, 21, 1500),
      animateNumber(setSkill3, 21, 1500),
      animateNumber(setSkill4, 21, 1500),
    ];

    return () => {
      timers.forEach(timer => clearInterval(timer));
    };
  }, []);

  return (
    <div className="col-xxl-3 order-xxl-first">
      <style dangerouslySetInnerHTML={{__html: `
        .resume-activities::-webkit-scrollbar {
          width: 4px !important;
        }
        .resume-activities::-webkit-scrollbar-button {
          display: none !important;
          height: 0 !important;
          width: 0 !important;
        }
        .resume-activities::-webkit-scrollbar-track {
          background: #2a2a2a !important;
        }
        .resume-activities::-webkit-scrollbar-thumb {
          background: #FFEC8F !important;
          border-radius: 4px !important;
        }
      `}} />
      <div className="resume-card" style={{ position: 'relative' }}>
        {/* Edit Button */}
        <button
          className="resume-edit-btn"
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            backgroundColor: '#FFA500',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 5,
            padding: 0
          }}
        >
          <i className="ti ti-pencil" style={{ fontSize: '12px', color: '#fff' }}></i>
        </button>

        {/* Header Section */}
        <div className="resume-header" style={{ position: 'relative' }}>
          <div className="resume-photo">
            <Image
              src="/images/0/crew profile/이안0.png"
              alt="Profile"
              width={240}
              height={273}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>

          {/* Hexagon Buttons */}
          <div style={{
            position: 'absolute',
            left: '213px',
            top: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            zIndex: 10
          }}>
            <button
              onClick={() => window.open('https://www.google.com/search?q=%ED%96%84%EB%B2%84%EA%B1%B0+%EC%82%AC%EC%A7%84&sca_esv=40968150e120a79c&udm=2&biw=1381&bih=788&sxsrf=AE3TifOFgqJNtdzBJSxlq7HqwOfJp2t41w%3A1763963847262&ei=x_MjaYDdD9LR1e8P34ba6QQ&ved=0ahUKEwjA3Iy0jYqRAxXSaPUHHV-DNk0Q4dUDCBI&uact=5&oq=%ED%96%84%EB%B2%84%EA%B1%B0+%EC%82%AC%EC%A7%84&gs_lp=Egtnd3Mtd2l6LWltZyIQ7ZaE67KE6rGwIOyCrOynhDIFEAAYgAQyBRAAGIAEMgUQABiABDIFEAAYgAQyBRAAGIAEMgUQABiABDIFEAAYgAQyBRAAGIAEMgUQABiABDIFEAAYgARIvzFQoQNY1zBwBHgAkAECmAGcAqABhxSqAQYxLjEyLjO4AQPIAQD4AQGYAgugApgIqAIEwgIGEAAYBxgewgIHECMYJxjJAsICCBAAGIAEGLEDwgIKECMYJxjJAhjqAsICCxAAGIAEGLEDGIMBwgIEEAAYA5gDBIgGAZIHAzUuNqAHzkqyBwMxLja4B_UHwgcFMi05LjLIB0k&sclient=gws-wiz-img', '_blank')}
              style={{
                width: '24px',
                height: '24px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                overflow: 'visible',
                position: 'relative'
              }}
              aria-label="hexagon button 1"
            >
              <Image src="/images/0/cluster 1/00.png" alt="" width={24} height={24} style={{ display: 'block' }} />
              <Image src="/images/0/cluster 1/001.png" alt="" width={12} height={12} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
            </button>

            <button
              onClick={() => window.open('https://youtu.be/xf6q5dgn1hU?si=tNK3I1-QIsJ9JmvF', '_blank')}
              style={{
                width: '24px',
                height: '24px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                overflow: 'visible',
                position: 'relative'
              }}
              aria-label="hexagon button 2"
            >
              <Image src="/images/0/cluster 1/00.png" alt="" width={24} height={24} style={{ display: 'block' }} />
              <Image src="/images/0/cluster 1/002.png" alt="" width={12} height={12} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
            </button>

            <button
              onClick={() => window.open('https://www.naver.com/', '_blank')}
              style={{
                width: '24px',
                height: '24px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                overflow: 'visible',
                position: 'relative',
                marginTop: '-3px'
              }}
              aria-label="hexagon button 3"
            >
              <Image src="/images/0/cluster 1/00.png" alt="" width={24} height={24} style={{ display: 'block' }} />
              <Image src="/images/0/cluster 1/003.png" alt="" width={12} height={12} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
            </button>
          </div>

          <div className="resume-info">
            <h1 className="resume-name">
              <span className="back-arrow" style={{ display: 'inline-flex', alignItems: 'center' }}>
                <Image src="/images/0/cluster 1/small icon/Chevron_Right_MD.png" alt="" width={18} height={18} />
              </span>이름 <span className="name-eng">English Name</span>
            </h1>

            <div className="resume-details">
              <div className="detail-row">
                <Image src="/images/0/cluster 1/small icon/User_01.png" alt="" width={16} height={16} />
                <span><span style={{ color: '#FFEC8F' }}>·</span> 남/여 <Image src="/images/0/cluster 1/small icon/Gift.png" alt="" width={13} height={13} style={{ display: 'inline-block', verticalAlign: 'text-bottom', margin: '0 2px' }} /> <span style={{ color: '#FFEC8F' }}>·</span> 2002.02.02</span>
              </div>
              <div className="detail-row">
                <Image src="/images/0/cluster 1/small icon/House_01.png" alt="" width={16} height={16} />
                <span><span style={{ color: '#FFEC8F' }}>·</span> 서울특별시 강남구</span>
              </div>
              <div className="detail-row">
                <Image src="/images/0/cluster 1/small icon/Mobile_Button.png" alt="" width={16} height={16} />
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ color: '#FFEC8F' }}>·</span> 010-1***-****
                  <span style={{
                    color: '#FFC300',
                    fontSize: '14px',
                    fontWeight: '400',
                    lineHeight: '1'
                  }}>+</span>
                </span>
              </div>
              <div className="detail-row">
                <Image src="/images/0/cluster 1/small icon/Mail.png" alt="" width={16} height={16} />
                <span style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '180px'
                }}><span style={{ color: '#FFEC8F' }}>·</span> writeyoureamil@gmail.com</span>
              </div>
              <div className="detail-row">
                <Image src="/images/0/cluster 1/small icon/Building_03.png" alt="" width={16} height={16} />
                <span style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '180px'
                }}><span style={{ color: '#FFEC8F' }}>·</span> 성균관대학교 <span style={{ color: '#FFEC8F' }}>미디어커뮤니케이션학과</span></span>
              </div>
              <div className="detail-row">
                <span style={{ width: '16px' }}></span>
                <span className="sub-text" style={{ color: '#FFEC8F' }}><span style={{ color: '#FFEC8F' }}>·</span> 2025. 03 - ~ing</span>
              </div>
              <div className="detail-row">
                <span style={{ width: '16px' }}></span>
                <span className="sub-text"><span style={{ color: '#FFEC8F' }}>·</span> 3.0 <span style={{ color: '#999999' }}>/4.5</span></span>
              </div>
            </div>
          </div>
        </div>

        {/* Introduction Box */}
        <div className="resume-intro">
          <Image
            src="/images/0/cluster 1/Image.png"
            alt=""
            width={24}
            height={24}
            className="intro-icon"
          />
          가장 어두운 순간에도 빛을 향해 용기 있게 한 걸음 내딛는 자에게는 언제나 반드시 새로운 길이 열리고 밝은 희망이 찾아온다
        </div>

        {/* Three Column Section - 영역 4, 5, 6 side by side */}
        <div className="resume-three-column">
          {/* Stats Section - 영역 4 */}
          <div className="resume-stats">
            <div className="stat-item">
              <div className="stat-row">
                <span className="stat-label">· 일정 신뢰도</span>
                <span className="stat-value">{stat1}<span className="stat-unit">%</span></span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${stat1}%` }}></div>
              </div>
            </div>
            <div className="stat-item">
              <div className="stat-row">
                <span className="stat-label">· 활동 완료율</span>
                <span className="stat-value">{stat2}<span className="stat-unit">%</span></span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${stat2}%` }}></div>
              </div>
            </div>
          </div>

          {/* Badges Section - 영역 5 */}
          <div className="resume-badges">
            <div className="badge-group">
              <span className="badge-icon icon-graphic10"></span>
              <span className="badge-num">{badge1}</span>
            </div>
            <div className="badge-group">
              <span className="badge-icon icon-shield"></span>
              <span className="badge-num">{badge2}</span>
            </div>
            <div className="badge-group">
              <span className="badge-icon icon-graphic13"></span>
              <span className="badge-num red">{badge3}</span>
            </div>
          </div>

          {/* Medal Badge - 영역 6 */}
          <div className="resume-medal">
            <div className="medal-image-wrapper">
              <Image
                src="/images/0/cluster 1/금장_OK.png"
                alt="Medal"
                width={98}
                height={98}
              />
            </div>
            <div className="medal-text">진행중</div>
          </div>
        </div>

        {/* Activities */}
        <div className="resume-activities" style={{
          width: '472px',
          height: '95px',
          maxHeight: '95px',
          minHeight: '95px',
          overflowY: 'scroll',
          overflowX: 'hidden',
          padding: 0,
          margin: 0,
          display: 'block',
          position: 'relative'
        } as React.CSSProperties}>
          <div className="activity-row">
            <div className="activity-avatar">
              <Image src="/images/0/cluster 1/01.png" alt="" width={36} height={36} />
            </div>
            <div className="activity-content">
              <div className="activity-line">
                <span className="activity-season">25, 겨울<span style={{ color: '#999' }}>시즌</span></span>
                <span className="activity-period">3주 <span style={{ color: '#999' }}>/ 16주</span></span>
                <span className="activity-role">운영진(앰베서더)</span>
                <span className="activity-badge active">진행중</span>
                <span className="activity-check pending">검수중</span>
              </div>
            </div>
          </div>

          <div className="activity-row">
            <div className="activity-avatar">
              <Image src="/images/0/cluster 1/02.png" alt="" width={36} height={36} />
            </div>
            <div className="activity-content">
              <div className="activity-line">
                <span className="activity-season">25, 겨울<span style={{ color: '#999' }}>시즌</span></span>
                <span className="activity-period">8주 <span style={{ color: '#999' }}>/ 8주</span></span>
                <span className="activity-role">심화(파트장)</span>
                <span className="activity-badge complete">정상 완료</span>
                <span className="activity-check approved">승인 완료</span>
              </div>
            </div>
          </div>

          <div className="activity-row">
            <div className="activity-avatar">
              <Image src="/images/0/cluster 1/03.png" alt="" width={36} height={36} />
            </div>
            <div className="activity-content">
              <div className="activity-line">
                <span className="activity-season">25, 여름<span style={{ color: '#999' }}>시즌</span></span>
                <span className="activity-period">12주 <span style={{ color: '#999' }}>/ 16주</span></span>
                <span className="activity-role">일반(정규)</span>
                <span className="activity-badge complete">정상 완료</span>
                <span className="activity-check approved">승인 완료</span>
              </div>
            </div>
          </div>
        </div>

        {/* Skill Cards and Footer Notices - with background */}
        <div className="resume-bottom-section">
          {/* Skill Cards */}
          <div className="resume-skills">
            <div className="skill-card">
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
                  <span className="skill-num">{skill1}</span>
                  <span style={{ fontSize: '10.8px', fontFamily: 'Pretendard, sans-serif', color: '#999' }}>unit</span>
                </div>
                <div className="skill-label">실무 역량 성장</div>
              </div>
            </div>
            <div className="skill-card">
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
                  <span className="skill-num">{skill2}</span>
                  <span style={{ fontSize: '10.8px', fontFamily: 'Pretendard, sans-serif', color: '#999' }}>건</span>
                </div>
                <div className="skill-label">실무 경험 축적</div>
              </div>
            </div>
            <div className="skill-card">
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
                  <span className="skill-num">{skill3}</span>
                  <span style={{ fontSize: '10.8px', fontFamily: 'Pretendard, sans-serif', color: '#999' }}>회</span>
                </div>
                <div className="skill-label">실무 정보 습득</div>
              </div>
            </div>
            <div className="skill-card">
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
                  <span className="skill-num">{skill4}</span>
                  <span style={{ fontSize: '10.8px', fontFamily: 'Pretendard, sans-serif', color: '#999' }}>proj</span>
                </div>
                <div className="skill-label">실무 경력 누적</div>
              </div>
            </div>
          </div>

          {/* Footer Notices */}
          <div className="resume-notices">
            <div className="notice-box yellow">
              <Image src="/images/0/cluster 1/Star Badge.png" alt="" width={25} height={25} className="notice-icon-img" />
              <span className="notice-text notice-text-top">전국청춘연합 마케팅/퍼포먼스 클럽, 오랑캐</span>
              <Image src="/images/0/cluster 1/오랑캐 도장.png" alt="" width={46} height={46} className="notice-stamp" />
            </div>
            <div className="notice-box green">
              <Image src="/images/0/cluster 1/Star Badge2.png" alt="" width={25} height={25} className="notice-icon-img" />
              <span className="notice-text">전국청춘성장 클럽, 실무/기업 관리 후원회</span>
              <Image src="/images/0/cluster 1/실무기업 도장.png" alt="" width={46} height={46} className="notice-stamp" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
