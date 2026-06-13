declare module 'multer' {
    import { RequestHandler } from 'express'
    function multer(options?: any): {
        single(field: string): RequestHandler
        array(field: string, maxCount?: number): RequestHandler
        fields(fields: Array<{ name: string; maxCount?: number }>): RequestHandler
        any(): RequestHandler
        none(): RequestHandler
    }
    namespace multer {
        function memoryStorage(): any
        function diskStorage(opts: any): any
    }
    export = multer
}
