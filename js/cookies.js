// ქუქი-ფაილებზე (Cookie) თანხმობის მართვა
class CookieConsent {
  constructor() {
    this.consentKey = 'gas-flows-cookie-consent';
    this.analyticsKey = 'gas-flows-analytics-consent';
    this.init();
  }

  init() {
    // ვამოწმებთ, უკვე გააკეთა თუ არა მომხმარებელმა არჩევანი
    const consent = localStorage.getItem(this.consentKey);
    if (!consent) {
      this.showCookieNotice();
    } else if (consent === 'accepted') {
      this.enableAnalytics();
    }
  }

  showCookieNotice() {
    // ჯერ წავშალოთ არსებული შეტყობინება, თუ ასეთი არსებობს
    this.hideCookieNotice();
    
    const notice = document.createElement('div');
    notice.className = 'cookie-notice';
    notice.innerHTML = `
      <div class="cookie-notice-content">
        <div class="cookie-notice-text">
          ეს ვებ-გვერდი იყენებს ქუქი-ფაილებს (cookies) ტრაფიკის გასაანალიზებლად და თქვენი გამოცდილების გასაუმჯობესებლად. 
          ჩვენ ვიყენებთ Google Analytics-ს იმის გასაგებად, თუ როგორ ურთიერთქმედებენ სტუმრები ჩვენს საიტთან.
          <a href="#" onclick="cookieConsent.showDetails(); return false;">გაიგეთ მეტი</a>
        </div>
        <div class="cookie-notice-buttons">
          <button class="cookie-btn cookie-btn-accept" onclick="cookieConsent.acceptCookies()">
            ყველას დათანხმება
          </button>
          <button class="cookie-btn cookie-btn-decline" onclick="cookieConsent.declineCookies()">
            უარყოფა
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(notice);
  }

  showCookieSettings() {
    // პარამეტრების განულება და შეტყობინების ხელახლა ჩვენება
    localStorage.removeItem(this.consentKey);
    localStorage.removeItem(this.analyticsKey);
    this.clearGoogleAnalyticsCookies();
    this.showCookieNotice();
  }

  acceptCookies() {
    localStorage.setItem(this.consentKey, 'accepted');
    localStorage.setItem(this.analyticsKey, 'true');
    this.enableAnalytics();
    this.hideCookieNotice();
    this.showConfirmation('ქუქი-ფაილები მიღებულია! ანალიტიკური თვალთვალი ჩართულია.');
  }

  declineCookies() {
    localStorage.setItem(this.consentKey, 'declined');
    localStorage.setItem(this.analyticsKey, 'false');
    this.disableAnalytics();
    this.hideCookieNotice();
    this.showConfirmation('ქუქი-ფაილებზე უარი ითქვა. გამოყენებული იქნება მხოლოდ აუცილებელი ფაილები.');
  }

  showConfirmation(message) {
    // მოკლე დადასტურების შეტყობინების ჩვენება
    const confirmation = document.createElement('div');
    confirmation.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #27ae60;
      color: white;
      padding: 10px 15px;
      border-radius: 4px;
      z-index: 10000;
      font-size: 14px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    `;
    confirmation.textContent = message;
    document.body.appendChild(confirmation);
    
    // წაშლა 3 წამის შემდეგ
    setTimeout(() => {
      if (confirmation.parentNode) {
        confirmation.parentNode.removeChild(confirmation);
      }
    }, 3000);
  }

  hideCookieNotice() {
    const notice = document.querySelector('.cookie-notice');
    if (notice) {
      notice.remove();
    }
  }

  enableAnalytics() {
    // Google Analytics-ის ჩართვა
    if (typeof gtag !== 'undefined') {
      gtag('consent', 'update', {
        'analytics_storage': 'granted'
      });
    }
  }

  disableAnalytics() {
    // Google Analytics-ის გამორთვა
    if (typeof gtag !== 'undefined') {
      gtag('consent', 'update', {
        'analytics_storage': 'denied'
      });
    }
    // არსებული GA ქუქიების წაშლა
    this.clearGoogleAnalyticsCookies();
  }

  clearGoogleAnalyticsCookies() {
    const cookies = document.cookie.split(";");
    for (let cookie of cookies) {
      const eqPos = cookie.indexOf("=");
      const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
      if (name.startsWith('_ga') || name.startsWith('_gid')) {
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
      }
    }
  }

  showDetails() {
    alert(`დეტალები ქუქი-ფაილების შესახებ:

აუცილებელი ფაილები: საჭიროა ვებ-გვერდის ძირითადი ფუნქციონირებისთვის.
   - სესიების მართვა
   - მომხმარებლის პარამეტრები (ფორმის მონაცემები, პარამეტრები)
   - უსაფრთხოების ფუნქციები

ანალიტიკური ფაილები: Google Analytics (არასავალდებულო)
   - გვერდების ნახვები და მომხმარებლის ინტერაქცია
   - ვებ-გვერდის მუშაობის მეტრიკა
   - გვეხმარება საიტის გაუმჯობესებაში

როგორ შევცვალოთ პარამეტრები:
   - გამოიყენეთ "ქუქი-ფაილების პარამეტრები" კონტაქტების გვერდზე
   - წაშალეთ ბრაუზერის მონაცემები და ხელახლა ეწვიეთ საიტს
   - დაგვიკავშირდით დახმარებისთვის

თქვენი კონფიდენციალურობა ჩვენთვის მნიშვნელოვანია. ჩვენ ვიყენებთ ანალიტიკას მხოლოდ საიტის გამოყენების გამოცდილების გასაუმჯობესებლად.`);
  }

  // მეთოდი იმის შესამოწმებლად, არის თუ არა თანხმობა ანალიტიკაზე
  isAnalyticsConsented() {
    return localStorage.getItem(this.analyticsKey) === 'true';
  }

  // მეთოდი პარამეტრების ხელით განსანულებლად (ტესტირებისთვის)
  resetCookieSettings() {
    localStorage.removeItem(this.consentKey);
    localStorage.removeItem(this.analyticsKey);
    this.clearGoogleAnalyticsCookies();
    this.showCookieNotice();
  }
}

// ინიციალიზაცია DOM-ის ჩატვირთვისას
let cookieConsent;
document.addEventListener('DOMContentLoaded', function() {
  cookieConsent = new CookieConsent();
});