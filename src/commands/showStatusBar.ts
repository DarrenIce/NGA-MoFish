import { updateStatusBar } from "../extension";

export default async function showStatusBar (title: string, page: number) {
    updateStatusBar(title, page);
}