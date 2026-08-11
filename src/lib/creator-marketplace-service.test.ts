import{describe,expect,it}from"vitest";import{calculateCreatorEarning,calculateDelinquentRefund,trackingDeadline,isTrackingDelinquent}from"./creator-marketplace-service";
describe("creator marketplace money and deadlines",()=>{
 it("sets the tracking deadline exactly 48 hours after payment",()=>expect(trackingDeadline("2026-08-11T10:00:00Z").toISOString()).toBe("2026-08-13T10:00:00.000Z"));
 it("is delinquent at the deadline unless tracking was submitted",()=>{expect(isTrackingDelinquent({deadline:"2026-08-13T10:00:00Z",now:"2026-08-13T10:00:00Z",trackingSubmitted:false})).toBe(true);expect(isTrackingDelinquent({deadline:"2026-08-13T10:00:00Z",now:"2026-08-14T10:00:00Z",trackingSubmitted:true})).toBe(false)});
 it("uses integer basis points for creator earnings",()=>expect(calculateCreatorEarning(12999,2000)).toEqual({grossCents:12999,platformFeeCents:2600,creatorNetCents:10399}));
 it("refunds the complete order when every line is delinquent",()=>expect(calculateDelinquentRefund({lineCents:12999,delinquentSubtotalCents:12999,orderSubtotalCents:12999,shippingCents:795,taxCents:1000})).toBe(14794));
 it("allocates tax but not shipping for one line in a mixed order",()=>expect(calculateDelinquentRefund({lineCents:5000,delinquentSubtotalCents:5000,orderSubtotalCents:10000,shippingCents:795,taxCents:800})).toBe(5400));
});
