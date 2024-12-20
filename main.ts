import { Plugin, moment, TFile } from 'obsidian';

export default class Startup extends Plugin {
	private dailyFolder = '_Daily/';
	private templatePath = '_Templates/Daily.md';
	private template = '';

	private noteFormat = /^\d{4}-\d{2}-\d{2}/;
	private dailyFormat = /^\d{4}-\d{2}-\d{2}$/;

	async onload() {
		this.setMomentLocale();

		this.app.workspace.onLayoutReady(async () => {
			await this.setTemplate();
			await this.checkAllForMissingDailys();
			this.registerEvent(
				this.app.vault.on('create', this.checkForMissingDaily.bind(this))
			);
		});
	}

	private setMomentLocale() {
		console.log('STARTUP: Set moment locale to "de"');
		moment.locale('de');
	}

	private async setTemplate() {
		const file = this.app.vault.getFileByPath(this.templatePath) as TFile;
		const content = await this.app.vault.cachedRead(file);
		this.template = content.replace('<% tp.file.cursor() %>\n', '');
	}

	private getDailyPath(date: string) {
		return this.dailyFolder + moment(date).format('YYYY/MM MMMM/');
	}

	private async exists(path: string) {
		return await this.app.vault.adapter.exists(path);
	}

	private async checkForMissingDaily(file: TFile) {
		if (!file) return;
		if (!file.path.startsWith(this.dailyFolder)) return;

		// @ts-ignore basename exists
		const filename = file.basename;
		if (!this.noteFormat.test(filename)) return;
		if (this.dailyFormat.test(filename)) return;

		const date = filename.slice(0, 10);
		const daily = this.getDailyPath(date) + date + '.md';
		if (await this.exists(daily)) return;

		console.log('STARTUP');
		console.log('    Note without corresponding daily created: ', filename);
		setTimeout(async () => await this.createDaily(date), 500);
	}

	private async checkAllForMissingDailys() {
		console.log('STARTUP: Check for missing daily notes');
		const all: TFile[] = this.app.vault.getMarkdownFiles();
		const path = all.filter((file) => file.path.startsWith(this.dailyFolder));
		const files = path.filter((file) => this.noteFormat.test(file.basename));
		const [dailys, notes] = partition(
			files,
			(f: TFile) => f.basename.length === 10
		);
		const dailyNames = dailys.map((daily: TFile) => daily.basename);

		notes.forEach((note: TFile) => {
			const correspondingDaily = note.basename.slice(0, 10);
			if (dailyNames.includes(correspondingDaily)) return;

			console.log('    Note without corresponding daily: ', note.basename);
			this.createDaily(correspondingDaily);
			dailyNames.push(correspondingDaily);
		});
	}

	private async createDaily(date: string) {
		const dailyPath = this.getDailyPath(date);
		const path = dailyPath + date + '.md';

		const folderExists = await this.exists(dailyPath);
		if (!folderExists) await this.app.vault.createFolder(dailyPath);

		const fileExists = await this.exists(path);
		if (fileExists) return console.warn(`${path} already exists`);

		await this.app.vault.create(path, this.template);
		console.log(`     Daily note created: ${date}`);
	}
}

function partition<T>(array: Array<T>, isValid: (e: T) => boolean) {
	return array.reduce(
		([pass, fail], elem) => {
			return isValid(elem)
				? [[...pass, elem], fail]
				: [pass, [...fail, elem]];
		},
		[[], []]
	);
}
