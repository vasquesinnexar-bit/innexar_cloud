"use client";

import Script from "next/script";

const CRM_FRONT = process.env.NEXT_PUBLIC_CRM_BASE_URL ?? "https://crm.innexar.com.br";
const CRM_API = process.env.NEXT_PUBLIC_CRM_API_URL ?? "https://api-crm.innexar.com.br";
const WEBSITE_TOKEN = process.env.NEXT_PUBLIC_CRM_WEBSITE_TOKEN;
const WIDGET_URL = process.env.NEXT_PUBLIC_CRM_WIDGET_URL;

/** Chat widget Evo CRM no site Innexar BR. */
export default function CrmChatWidget() {
  // O SDK não está hospedado em innexar.com.br nem no CRM neste momento.
  // Só carregamos o chat quando houver uma URL explícita e válida para ele;
  // assim um 404 não chega ao navegador nem gera erro de MIME no console.
  if (!WEBSITE_TOKEN || !WIDGET_URL) return null;

  return (
    <Script
      id="innexar-crm-chat-widget"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
(function(d,t){
  var CRM_FRONT="${CRM_FRONT}";
  window.evoChatSettings={apiBase:"${CRM_API}",position:"right",type:"standard",launcherTitle:"Chat"};
  var s=d.createElement(t),x=d.getElementsByTagName(t)[0];
  s.src="${WIDGET_URL}";
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
