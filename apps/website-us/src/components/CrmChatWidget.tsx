"use client";

import Script from "next/script";

const CRM_FRONT = process.env.NEXT_PUBLIC_CRM_BASE_URL ?? "https://crm.innexar.com.br";
const CRM_API = process.env.NEXT_PUBLIC_CRM_API_URL ?? "https://api-crm.innexar.com.br";
const WEBSITE_TOKEN = process.env.NEXT_PUBLIC_CRM_WEBSITE_TOKEN;

/** Chat widget Evo CRM — Innexar USA. */
export default function CrmChatWidget() {
  if (!WEBSITE_TOKEN) return null;

  return (
    <Script
      id="innexar-usa-crm-chat-widget"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
(function(d,t){
  var CRM_FRONT="${CRM_FRONT}";
  var SDK_BASE=window.location.origin+"/crm-embed";
  window.evoChatSettings={apiBase:"${CRM_API}",position:"right",type:"standard",launcherTitle:"Chat"};
  var s=d.createElement(t),x=d.getElementsByTagName(t)[0];
  s.src=SDK_BASE+"/widget-sdk/sdk.min.js";
  s.async=true;s.defer=true;
  x.parentNode.insertBefore(s,x);
  s.onload=function(){
    if(window.evoChatSDK&&window.evoChatSDK.run){
      window.evoChatSDK.run({baseUrl:CRM_FRONT,websiteToken:"${WEBSITE_TOKEN}"});
    }
  };
})(document,"script");
        `.trim(),
      }}
    />
  );
}
