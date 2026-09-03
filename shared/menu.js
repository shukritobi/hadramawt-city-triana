import {FOOD_A} from './menu-food-a.js';
import {FOOD_B} from './menu-food-b.js';
import {DRINKS_A} from './menu-drinks-a.js';
import {DRINKS_B} from './menu-drinks-b.js';
export const MENU_CATEGORIES=["Family Sets","Appetizers","Salads","House Specials","Rice Dishes","Hot Dishes","B.B.Q","Shawarma & Sandwiches","Desserts","Soups","Add-Ons","Fresh Juices","House Specials & Milkshakes","Cold & Hot Drinks"];
export const MENU_ITEMS=[...FOOD_A,...FOOD_B,...DRINKS_A,...DRINKS_B];
export function getMenuItem(id){return MENU_ITEMS.find(i=>i.id===id)}
export function getOption(item,label){return item?.options?.find(o=>o.label===label)}
export function formatMYR(value){return new Intl.NumberFormat('en-MY',{style:'currency',currency:'MYR',minimumFractionDigits:2}).format(value)}
