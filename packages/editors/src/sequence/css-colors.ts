// Mermaid reads the first word of a box title as its color when the browser accepts it as a CSS
// color (`CSS.supports`). v1 asked the browser too; this list answers the same without a DOM.
const NAMED_COLORS: ReadonlySet<string> = new Set(
  (
    'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown ' +
    'burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan ' +
    'darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid ' +
    'darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet ' +
    'deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ' +
    'ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki ' +
    'lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow ' +
    'lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray ' +
    'lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine ' +
    'mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise ' +
    'mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab ' +
    'orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru ' +
    'pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown ' +
    'seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan ' +
    'teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen transparent currentcolor ' +
    'accentcolor accentcolortext activetext buttonborder buttonface buttontext canvas canvastext field ' +
    'fieldtext graytext highlight highlighttext linktext mark marktext selecteditem selecteditemtext visitedtext ' +
    'activeborder activecaption appworkspace background buttonhighlight buttonshadow captiontext ' +
    'inactiveborder inactivecaption inactivecaptiontext infobackground infotext menu menutext scrollbar ' +
    'threeddarkshadow threedface threedhighlight threedlightshadow threedshadow window windowframe windowtext'
  ).split(' '),
);

const HEX_COLOR: RegExp = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNCTION_COLOR: RegExp = /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(.*\)$/i;

/** Does a browser accept `word` as a CSS color (`CSS.supports('color', word)`)? */
export function isCssColor(word: string): boolean {
  return NAMED_COLORS.has(word.toLowerCase()) || HEX_COLOR.test(word) || FUNCTION_COLOR.test(word);
}
