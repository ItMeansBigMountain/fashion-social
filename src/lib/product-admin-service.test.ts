import { describe,expect,it } from "vitest";
import { parseProductMutation } from "./product-admin-service";
describe("product admin validation",()=>{
 const valid={id:"new-dress",name:"New Dress",brand:"Fashion Social",category:"Dresses",color:"Black",description:"A detailed garment description.",currency:"usd",imageUrl:"/products/new-dress.jpg",imageAlt:"Black tailored dress",featured:false,active:true,variants:[{id:"new-dress-s",sku:"FS-NEW-S",label:"S",priceCents:9900,inventory:5,weightGrams:600,active:true}]};
 it("accepts a complete product with variants",()=>expect(parseProductMutation(valid)).toMatchObject({id:"new-dress",variants:[{sku:"FS-NEW-S"}]}));
 it.each([
  [{...valid,id:"Bad ID"},"identifier"],
  [{...valid,variants:[]},"variant"],
  [{...valid,variants:[{...valid.variants[0],priceCents:-1}]},"price"],
  [{...valid,currency:"dollars"},"currency"],
 ])("rejects invalid catalog input",(payload,message)=>expect(()=>parseProductMutation(payload)).toThrow(message));
});
