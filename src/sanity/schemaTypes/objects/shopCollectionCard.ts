import { defineType, defineField } from 'sanity';
import { SHOP_COLLECTIONS } from '../../../lib/shopCollections';
export const shopCollectionCard = defineType({
    name: 'shopCollectionCard', title: 'Collection card', type: 'object',
    fields: [
        defineField({name:'collectionKey',title:'Collection',type:'string',options:{list:SHOP_COLLECTIONS.map(c=>({title:c.title,value:c.key}))},validation:r=>r.required().custom(value => SHOP_COLLECTIONS.some(c=>c.key===value) || "Select an existing collection.")}),
        defineField({name:'title',title:'Display title',type:'string',description:'Optional; defaults to the collection name.'}),
        defineField({name:'subtitle',title:'Description',type:'string'}),
        defineField({name:'image',title:'Collection image',type:'image',options:{hotspot:true},description:'Show the actual dispenser or product format on its stone platform. Shared by desktop and mobile.'}),
        defineField({name:'order',title:'Order',type:'number',initialValue:0}),
        defineField({name:'enabled',title:'Feature on homepage',type:'boolean',initialValue:true}),
    ],preview:{select:{title:'title',key:'collectionKey',media:'image'},prepare({title,key,media}){return{title:title||SHOP_COLLECTIONS.find(c=>c.key===key)?.title||'Collection',media};}},
});
export const buildYourBottleBlock=defineType({name:'buildYourBottleBlock',title:'Build your bottle',type:'object',fields:[
    defineField({name:'heading',type:'string',initialValue:'Build your bottle.'}),
    defineField({name:'description',type:'text',rows:3}),
    defineField({name:'image',type:'image',options:{hotspot:true}}),
    defineField({name:'buttonLabel',title:'Button label',type:'string',initialValue:'Build your bottle'}),
    defineField({name:'destination',type:'string',options:{list:[{title:'Bottle builder',value:'/matrix'},{title:'Collections directory',value:'/collections'}]},initialValue:'/matrix',validation:r=>r.custom(value => !value || ['/matrix','/collections'].includes(value) || 'Select a supported destination.')}),
]});
