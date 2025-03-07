// https://www.charpeni.com/blog/properly-type-object-keys-and-object-entries

export const objectKeys = <T extends object>(obj: T): (keyof T)[] =>
    Object.keys(obj) as (keyof T)[];

type Entries<T> = {
    [K in keyof T]: [K, T[K]];
}[keyof T][];

export const objectEntries = <T extends object>(
    obj: T
): [keyof typeof obj, T[keyof T]][] =>
    (Object.entries(obj) as Entries<typeof obj>).map(([key, value]) => [
        key,
        value,
    ]);
