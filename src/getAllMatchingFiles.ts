import { statSync } from "fs"
import { readdir } from "fs/promises"
import micromatch from 'micromatch'
import { join } from "path"

export async function getAllMatchingFiles(dir: string, glob: string): Promise<string[]> {
    const files = await readdir(dir)
    const matchedFiles = await Promise.all<string[] | string | undefined>(
        files.map(async (f) => {
            const fullPath = join(dir, f)
            if (statSync(fullPath).isDirectory()) {
                return await getAllMatchingFiles(fullPath, glob)
            } else {
                return micromatch.isMatch(fullPath, glob) ? fullPath : undefined
            }
        })
    )

    return matchedFiles.reduce((res: string[], fMatch) => {
        if (!fMatch) {
            return res
        }
        if (Array.isArray(fMatch)) {
            res.push(...fMatch)
        } else {
            res.push(fMatch)
        }

        return res
    }, [] as string[])
}