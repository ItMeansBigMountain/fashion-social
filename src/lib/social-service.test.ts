import {describe,expect,it} from "vitest";import {parseSocialSubmission,providerForSocialUrl,truthfulSocialLabel} from "./social-service";
describe("compliant social ingestion",()=>{
 it("normalizes rights-confirmed submissions with product links",()=>{const value=parseSocialSubmission({url:"https://www.instagram.com/p/ABC123/?utm_source=x",creatorHandle:"@creator",productIds:["city-knit"],rightsConfirmed:true,rightsBasis:"Creator granted storefront display rights"});expect(value).toMatchObject({platform:"instagram",canonicalUrl:"https://instagram.com/p/ABC123",creatorHandle:"creator",status:"pending"})});
 it("rejects unconfirmed rights and unsupported platforms",()=>{expect(()=>parseSocialSubmission({url:"https://tiktok.com/@a/video/1",creatorHandle:"a",productIds:["city-knit"],rightsConfirmed:false,rightsBasis:""})).toThrow("rights");expect(()=>providerForSocialUrl("https://example.com/post/1")).toThrow("Unsupported")});
 it("labels engagement as a timestamped snapshot rather than a review",()=>expect(truthfulSocialLabel({likes:1200,capturedAt:"2026-08-11T00:00:00Z"})).toBe("1,200 platform likes · snapshot Aug 11, 2026"));
});
