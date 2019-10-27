const prettyText =
  {
    capitalizeFirstLetter ( string )
    {
      return string.charAt( 0 ).toUpperCase() + string.slice( 1 );
    },

    checkForManipulators ( string )
    {
      return ! ( /\s/.test( string ) );
    },

    checkForManipulatorsExceptSpace ( string )
    {
      return ! ( /(\n\r\t)+/.test( string ) );
    },

    /**
     1. реал мадрид -> Реал Мадрид
     2. Манчестер Сити -> Манчестер Сити
     3. севилья -> Севилья
     4. НЬЮкасл
     юНаЙтЕд -> Ньюкасл Юнайтед
     */
    prettyCapitalWords ( string )
    {
      let words = [ ];
      words = string.split( /\s+/ );

      let formattedString = '';
      words.forEach( ( element ) =>
      {
        element = element.toLowerCase();
        element =  element.charAt( 0 ).toUpperCase() + element.slice( 1 );
        formattedString += `${element} `;
      } );
      formattedString = formattedString.slice( 0, formattedString.length - 1 );
      return formattedString;
    },
    /**
     1. реал мадрид -> Реал мадрид
     2. Манчестер Сити -> Манчестер сити
     3. севилья -> Севилья
     4. НЬЮкасл
     юНаЙтЕд -> Ньюкасл юнайтед
     */
    prettyWords ( string )
    {
      let words = [ ];
      words = string.split( /\s+/ );

      let formattedString = '';
      let firstWord = true;
      words.forEach( ( element ) =>
      {
        element = element.toLowerCase();
        if ( firstWord )
        {
          element = element.charAt( 0 ).toUpperCase() + element.slice( 1 );
          firstWord = ! firstWord;
        }
        formattedString += `${element} `;
      } );
      formattedString = formattedString.slice( 0, formattedString.length - 1 );
      return formattedString;
    },
  };

module.exports = prettyText;

/*eslint-disable */

// //delete repeating break lines and spaces (VK style)
// data = data.replace(/(\s)\s+/g, (match, p1) =>
// {
//     if(/\n/.test(match)) return '\n';
//     else return p1;
// });
