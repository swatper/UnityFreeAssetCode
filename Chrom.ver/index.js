//확장 프로그램 설치 시 실행
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["installed"], (result) => {
    if (!result.installed) {
      checkFreeAssets();
      chrome.storage.local.set({ installed: true });
    }
  });

//매주 금요일 오전 9시 알람 설정
chrome.alarms.create("checkFreeAssets", {
  when: getNextFriday9AM(),
  periodInMinutes: 7 * 24 * 60 //1주일마다 실행
  });
});

//크롬을 켤때마다 실행
chrome.runtime.onStartup.addListener(() => {
  //알람 설정
  const now = new Date();
    // 오늘이 금요일이면 시작 시 알람을 설정하지 않음
    if (now.getDay() !== 5) {
        // 알람 설정
        chrome.alarms.create("runOnStartup", {
            when: Date.now() + 5000,
        });
    }
});

//알람이 울릴 때 실행
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkFreeAssets" || alarm.name === "runOnStartup") {
    checkFreeAssets();
  }
});

chrome.alarms.getAll((alarms) => {
  console.log("현재 알람 목록:", alarms);
});

//상품 페이지 로드 감지
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  chrome.storage.local.get(["lastAssetUrl", "lastAssetCode"], (data) => {
      if (changeInfo.status === "complete" && tab.url === data.lastAssetUrl) {
          //쿠폰 코드 알림 생성
          chrome.notifications.create("couponCodeNotification", {
              type: "basic",
              iconUrl: "icon48.png",
              title: "유니티 에셋 무료 쿠폰 코드!",
              message: `쿠폰 코드: ${data.lastAssetCode}`,
              buttons: [{ title: "쿠폰 코드 복사하기" }],
          });
      }
  });
});

//버튼 기능 설정
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  //상품 페이지 이동 버튼
  if (notificationId === "freeAssetNotification" && buttonIndex === 0) {
    chrome.storage.local.get("lastAssetUrl", (data) => {
      if (data.lastAssetUrl) {
        chrome.tabs.create({ url: data.lastAssetUrl });
      } 
      else {
        chrome.tabs.create({ url: "https://assetstore.unity.com/ko-KR/publisher-sale" });
      }
    });
  }
  //쿠폰 복사 버튼
  if (notificationId === "couponCodeNotification" && buttonIndex === 0) {
    chrome.storage.local.get("lastAssetCode", (data) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
          chrome.tabs.sendMessage(tabs[0].id, { action: "copyToClipboard", text: data.lastAssetCode }, (response) => {
            if (response && response.success) {
              chrome.notifications.create("couponCodeNotification", {
                type: "basic",
                iconUrl: "icon48.png",
                title: "유니티 에셋 무료 쿠폰 코드!",
                message: "쿠폰 코드가 클립보드에 복사되었습니다."
              });
            } else {
              chrome.notifications.create("couponCodeNotification", {
                type: "basic",
                iconUrl: "icon48.png",
                title: "유니티 에셋 무료 쿠폰 코드!",
                message: "쿠폰 복사 실패"
              });
            }
          });
        }
      });
    });
  }
});

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//다음 금요일 오전 9시 타임스탬프 계산
function getNextFriday9AM() {
  const now = new Date();
  const day = now.getDay();
  const diff = (5 + 7 - day) % 7; //다음 금요일까지 남은 일 수
  const nextFriday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff, 9, 0, 0);
  return nextFriday.getTime();
}

//무료 에셋 쿠폰 코드 확인
async function checkFreeAssets() {
  try {
    const { couponCode, assetUrl } = await getCouponCodeData("https://assetstore.unity.com/ko-KR/publisher-sale");
    //이전 무료 코드와 비교
    chrome.storage.local.get("lastAssetCode", (result) => {
      const lastAssetCode = result.lastAssetCode;

      //쿠폰 코드가 같다면 알림을 보내지 않음
      if (lastAssetCode === couponCode) {
        chrome.notifications.create("freeAssetNotification", {
          type: "basic",
          iconUrl: "icon48.png",
          title: "유니티 에셋 무료 코드!",
          message: "아직 새로운 코드가 업로드되지 않았습니다."
        });
        return;
      }
    });

    //로컬에 쿠폰이랑 상품 페이지 주소 저장
    chrome.storage.local.set({ lastAssetCode: couponCode, lastAssetUrl: assetUrl });

    if (couponCode) {
      chrome.notifications.create("freeAssetNotification", {
        type: "basic",
        iconUrl: "icon48.png",
        title: "유니티 에셋 무료 코드!",
        message: `쿠폰 코드: ${couponCode} \n상품 페이지를 확인하세요!`,
        buttons: [{ title: "상품 페이지 이동" }]
      });
    } else {
      chrome.notifications.create("freeAssetNotification", {
        type: "basic",
        iconUrl: "icon48.png",
        title: "유니티 에셋 무료 코드!",
        message: "무료 쿠폰 코드를 찾을 수 없습니다."
      });
    }
  } catch (error) {
    console.error("무료 에셋 정보 가져오기 실패:", error);
  }
}

//웹페이지에서 쿠폰 코드과 상품 페이지 가져오기
async function getCouponCodeData(url) {
  try {
    const response = await fetch(url);
    const html = await response.text();

    //정규식으로 "the coupon code XXXXX" 패턴 찾기
    const couponMatch  = html.match(/the coupon code\s+([A-Z0-9]+)/i);
    const couponCode = couponMatch ? couponMatch[1] : null;

    //상품 페이지 주소 찾기
    const assetMatch = html.match(/<a[^>]+href="([^"]+)"[^>]*>\s*<span[^>]*>\s*<span[^>]*>\s*Get your gift\s*<\/span>\s*<\/span>\s*<\/a>/i);
    const assetUrl = assetMatch ? `https://assetstore.unity.com${assetMatch[1]}` : null;

    return  { couponCode, assetUrl };
  } catch (error) {
    console.error("페이지 로드 실패:", error);
    return null;
  }
}