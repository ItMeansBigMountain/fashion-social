import InviteExchange from"./invite-exchange";
export default async function Page({searchParams}:{searchParams:Promise<{token?:string}>}){const{token}=await searchParams;return <InviteExchange token={token??null}/>}
