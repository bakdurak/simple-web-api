//it's difficult to check all image extension to quality rate
//because we use idle run of compressing to find out
//whether the input image has been compressed
//if it was then check that size after compress
//less or is not much larger than the source
//Note: it help to avoid attack when malicious user
//sends images with quality 1 and size almost equal to max image size
//as a result on a server will appear images with size a lot more
//than available size
const isImgSizeSmallerAfterCompress = async (req) =>
{
    const imgSizeAfterCompress = ( await sharp( req.file.buffer )
        .toFormat('jpg')
        .jpeg({
            quality: config.uploads.JPEG_QUALITY
        })
        .toBuffer( { resolveWithObject: true } ) ).info.size;

    console.log( `Img size BEFORE compress size: ${req.file.size}` );
    console.log( `Img size AFTER compress size: ${imgSizeAfterCompress}` );

    //even on the same quality like source image, size 'after' could a little bit greater than before
    //because of some custom options of sharp or more lightweight extension like webp
    //so introduce some coefficient
    const coeffErr = 1.2;
    const imgSizeBeforeCompress = req.file.size;
    return ( imgSizeAfterCompress < ( imgSizeBeforeCompress * coeffErr ) );
};

module.exports = isImgSizeSmallerAfterCompress;
