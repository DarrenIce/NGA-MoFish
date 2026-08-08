import { User } from "../models/user";

function isRecord(value: unknown): value is { [key: string]: any } {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isPlaceholderName(name: string, uid: string): boolean {
  const normalized = name.trim();
  return !normalized
    || normalized === uid
    || normalized === `UID:${uid}`
    || normalized === `UID：${uid}`;
}

export function mergeNgaUserMetadata(primaryData: any, recoveredData: any): any {
  if (!isRecord(primaryData) || !isRecord(recoveredData?.__U)) {
    return primaryData;
  }

  const primaryUsers = isRecord(primaryData.__U) ? primaryData.__U : {};
  const mergedData = { ...primaryData };
  mergedData["__U"] = {
    ...primaryUsers,
    ...recoveredData.__U,
  };
  return mergedData;
}

export function createNgaUserMap(
  jsUsers: any,
  storedUsers: User[]
): Map<string, User> {
  const userMap = new Map<string, User>();

  storedUsers.forEach((storedUser) => {
    if (storedUser?.uid) {
      userMap.set(String(storedUser.uid), storedUser);
    }
  });

  if (!isRecord(jsUsers)) {
    return userMap;
  }

  Object.keys(jsUsers).forEach((key) => {
    const rawUser = jsUsers[key];
    if (!isRecord(rawUser) || rawUser.uid === undefined || rawUser.uid === null) {
      return;
    }

    const uid = String(rawUser.uid);
    const storedUser = userMap.get(uid);
    const rawName = typeof rawUser.username === "string" ? rawUser.username.trim() : "";
    const storedName = storedUser?.userNmae || "";
    const user = new User();
    user.uid = uid;
    user.userNmae = !isPlaceholderName(rawName, uid)
      ? rawName
      : !isPlaceholderName(storedName, uid)
        ? storedName
        : uid;
    user.regDate = rawUser.regdate === undefined || rawUser.regdate === null
      ? storedUser?.regDate || ""
      : String(rawUser.regdate);
    user.labels = storedUser?.labels || [];
    userMap.set(uid, user);
  });

  return userMap;
}
