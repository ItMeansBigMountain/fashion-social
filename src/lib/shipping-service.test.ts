import {describe,expect,it} from "vitest";
import {buildManualShipment,buildShippoShipmentRequest,transitionReturn} from "./shipping-service";
describe("shipping workflows",()=>{
 it("builds a manual tracked shipment",()=>expect(buildManualShipment({orderId:"7d934ffc-df8c-4a20-a042-324f53eb3456",carrier:"USPS",service:"Ground Advantage",trackingNumber:"9400111899223856928499"})).toMatchObject({status:"shipped",carrier:"USPS"}));
 it("rejects incomplete tracking",()=>expect(()=>buildManualShipment({orderId:"x",carrier:"USPS",service:"Ground",trackingNumber:""})).toThrow(/tracking/i));
 it("builds a Shippo-compatible parcel/address request without credentials",()=>{const request=buildShippoShipmentRequest({name:"Buyer",line1:"1 Main St",city:"Chicago",state:"IL",postalCode:"60601",country:"US"},{weightGrams:900,lengthCm:30,widthCm:20,heightCm:10});expect(request.parcels[0]).toMatchObject({mass_unit:"g",weight:"900"});expect(request.address_to.zip).toBe("60601")});
 it("allows controlled return transitions",()=>{expect(transitionReturn("requested","approved")).toBe("approved");expect(()=>transitionReturn("refunded","requested")).toThrow("transition")});
});
