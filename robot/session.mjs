// A fresh incognito context has no previous profile, storageState or persistent browser directory.
// Tokens may survive this run's reloads, but no authenticated browser state is exported or cached.
export async function openPublisherBrowser(chromium,channel,timeZone){
  const browser=await chromium.launch({channel,headless:true});
  try{
    const context=await browser.newContext({timezoneId:timeZone,viewport:{width:412,height:915}});
    return {browser,context};
  }catch(error){await browser.close();throw error;}
}
