import Script from "next/script";
import { ANALYTICS_PROVIDER, GA_ID, POSTHOG_HOST, POSTHOG_KEY } from "@/lib/analytics/config";

export function AnalyticsScripts() {
  if (ANALYTICS_PROVIDER === "ga4" && GA_ID) {
    return (
      <>
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
        <Script
          id="ga4-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}', { send_page_view: false });
            `,
          }}
        />
      </>
    );
  }

  if (ANALYTICS_PROVIDER === "posthog" && POSTHOG_KEY) {
    return (
      <Script
        id="posthog-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){
            function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){
            t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}
            (p=t.createElement("script")).type="text/javascript",p.async=!0,p.src="${POSTHOG_HOST}/static/array.js",
            (r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);
            var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";
            return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},
            o="capture identify alias people.set people.set_once people.unset people.increment people.append people.remove people.group".split(" "),
            n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
            posthog.init('${POSTHOG_KEY}', { api_host: '${POSTHOG_HOST}' });
          `,
        }}
      />
    );
  }

  return null;
}
