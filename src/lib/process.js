import * as cheerio from 'cheerio'
import { parseSrcset } from 'srcset'
import TurndownService from 'turndown'

const turndownService = new TurndownService()

const getUnsizedImageName = str => {
  const noSizeRegex = /(.*)(_[0-9]{1,4}x[0-9]{1,4}.[a-z]{2,4})/gim
  let srcParts = str.split(/\/|%2F/)
  let last = srcParts.slice(-1)[0]
  let matches = noSizeRegex.exec(last)

  if (matches) {
    return matches[1]
  } else {
    return str
  }
}

const largestSrc = $imageElem => {
  const src = $imageElem.attr('src')
  const srcset = $imageElem.attr('srcset') || false

  let srcToUse = src

  if (srcset) {
    const parsedSrcset = parseSrcset(srcset)

    if (parsedSrcset && parsedSrcset.length > 0) {
      srcToUse = parsedSrcset[0].url
    }
  }

  // Remove the width from the image URL
  if (srcToUse) {
    srcToUse = srcToUse.replace(/w_[0-9]{2,4},c_limit,/, '')
  } else {
    srcToUse = src
  }
  console.log(src, srcToUse)
  return srcToUse
}

function processSubstackData(data) {
  let output = {}
  let {html} = data  

  // If there's no HTML, exit & return an empty string to avoid errors
  if (!html) {
    console.debug(`Post has no HTML content`)
    return ''
  }
  

  // As there is HTML, pass it to Cheerio inside a `<body>` tag so we have a global wrapper to target later on
  const $ = cheerio.load(`<body>${html}</body>`, {
    decodeEntities: false
  })

  // Empty text elements are commonplace and are not needed
  $('p').each((i, el) => {
    let content = $(el).html().trim()

    if (content.length === 0) {
      $(el).remove()
    }
  })

  let firstElement = $('body *').first()
  
  if (
    firstElement.tagName === 'img' ||
    ($(firstElement).get(0) && $(firstElement).get(0).name === 'img') ||
    $(firstElement).find('img').length
  ) {
    let theElementItself =
      firstElement.tagName === 'img' || $(firstElement).get(0).name === 'img'
        ? firstElement
        : $(firstElement).find('img')

        let firstImgSrc = largestSrc($(theElementItself))
        output.image = firstImgSrc
      $(firstElement).remove()
  }

  $('div.tweet').each((i, el) => {
    let src = $(el).children('a').attr('href')
    let url = new URL(src)

    if (url.searchParams) {
      // remove possible query params
      url.searchParams.forEach(p => url.searchParams.delete(p))
    }
    src = url.toString()

    let $figure = $('<figure></figure>')
    let $blockquote = $('<blockquote class="twitter-tweet"></blockquote>')
    let $anchor = $(`<a href="${src}"></a>`)
    let $script = $(
      '<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>'
    )

    $blockquote.append($anchor)

    $figure.append($blockquote)
    $figure.append($script)

    $(el).replaceWith($figure)
  })

  $('.captioned-image-container').each((i, div) => {
    const imgAlt = $(div).find('img[alt]').attr('alt') || ''
    // const linkHref = $(div).find("a.image-link").attr("href") || false;
    const imgCaption = $(div).find('figcaption').html() || false
    const imageSrc = largestSrc($(div).find('img'))

    let $figure = $('<figure></figure>')
    let $img = $(`<img src="${imageSrc}" alt="${imgAlt}">`)
    let $caption = $(`<figcaption>${imgCaption}</figcaption>`)
    //let $anchor = $(`<a href="${imageSrc}"></a>`);

    $figure.append($img)
    if (imgCaption) {
      $figure.append($caption)
    }

    $(div).replaceWith($figure)
  })

  $('.image-link').each((i, anchor) => {
    const imgAlt = $(anchor).find('img[alt]').attr('alt') || ''
    const linkHref = $(anchor).attr('href')
    const imageSrc = largestSrc($(anchor).find('img'))

    let $anchor = $(`<a href="${linkHref}"></a>`)
    let $img = $(`<img src="${imageSrc}" alt="${imgAlt}">`)

    $anchor.append($img)

    $(anchor).replaceWith(linkHref ? $anchor : $img)

    $('a > style').each((i, style) => {
      $(style).remove()
    })
  })

  // Remove Substack buttons
  $('p.button-wrapper').each((i, button) => {
    $(button).remove()
  })

  // convert HTML back to a string
  html = $('body').html()

  // Apply our new HTML back to the post object
  output.html = html.trim()
  output.markdown = turndownService.turndown(output.html)
  return {...data, ...output}
}

export { processSubstackData }

