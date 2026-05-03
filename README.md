# Automated Paper Binding Machine (3D Viewer)

Web app na nagpapakita ng **3D simulation** ng Automated Paper Binding Machine (model mula sa Fusion 360, `.fbx`). Ginagamit ang **React**, **TypeScript**, **Vite**, at **Three.js**.

---

## Mga kailangan bago magsimula (Prerequisites)

Ikaw ay dapat may:

1. **Computer** na Windows, macOS, o Linux  
2. **Node.js** (LTS na bersyon ay inirerekomenda, hal. **18.x o 20.x**)

### Paano tingnan kung may Node.js ka na

Buksan ang **Terminal** (macOS/Linux) o **Command Prompt / PowerShell** (Windows), tapos i-type:

```bash
node --version
```

Kung may lumabas na numero (hal. `v20.x.x`), okay na ang Node.js.

### Kung wala ka pang Node.js

- Pumunta sa **[https://nodejs.org](https://nodejs.org)**  
- I-download ang **LTS** na installer para sa iyong sistema  
- Sundin ang wizard (Next → Install). Pagkatapos, buksan ulit ang terminal at subukan ang `node --version`  

Kasama na sa Node.js ang **npm** (package manager) — hindi mo kailangang i-install nang hiwalay.

---

## Paano kunin ang project (Download)

### Opsyon A: Gamit ang Git (kung alam mo ang Git)

```bash
git clone <URL-ng-repository-mo-dito>
cd Automated_Binding _machine
```

Palitan ang `<URL-ng-repository-mo-dito>` ng tunay na link ng repo (hal. mula sa GitHub → **Code** → HTTPS).

### Opsyon B: ZIP mula sa GitHub (madalas para sa estudyante)

1. Buksan ang project page sa **GitHub** (o kung saan naka-host ang code).  
2. Pindutin ang berdeng **Code** button.  
3. Piliin ang **Download ZIP**.  
4. Pagkatapos ma-download, i-extract ang ZIP sa folder na gusto mo (hal. `Desktop`).  
5. Buksan ang **Terminal** / **PowerShell** at pumunta sa folder ng project:

**Windows (PowerShell):**

```powershell
cd "C:\Users\IyongUser\Desktop\Automated_Binding _machine"
```

*(Baguhin ang path kung saan mo talaga in-extract ang folder.)*

**macOS / Linux:**

```bash
cd ~/Desktop/Automated_Binding\ _machine
```

---

## Paano i-install ang dependencies

Nasa **loob** ng project folder, patakbuhin **isa** sa mga ito:

```bash
npm install
```

Hintayin matapos. Makikita ang folder na **`node_modules`** — normal iyon; huwag i-commit sa Git kung may `.gitignore` na.

**Kung may error:**  
- Siguraduhing naka-install ang Node.js LTS.  
- Subukan i-delete ang `node_modules` at ang `package-lock.json` (kung mayroon), tapos ulitin ang `npm install`.

---

## Paano patakbuhin ang app (development)

```bash
npm run dev
```

Makikita sa terminal ang address, hal.:

```text
  ➜  Local:   http://localhost:5173/
```

Buksan ang **browser** (Chrome, Edge, Firefox) at i-type ang address na iyon.

**I-stop ang server:** sa terminal, pindutin `Ctrl + C`.

---

## Iba pang useful na commands (opsyonal)

| Command | Gamit |
|--------|--------|
| `npm run build` | Gawa ng production build sa folder `dist/` |
| `npm run preview` | I-preview ang build (pagkatapos ng `build`) |
| `npm run typecheck` | Suriin ang TypeScript |
| `npm run lint` | Patakbuhin ang ESLint |

---

## Mahalaga tungkol sa 3D model

Ang FBX file dapat nasa:

```text
public/Automated_Paper_Binding_Machine.fbx
```

Kung wala iyon, lalabas ang mensahe sa app na hindi na-load ang model. Siguraduhing kasama ang `public` folder at ang `.fbx` kapag nag-copy o nag-download ng project.

---

## Maikling checklist para sa estudyante

1. [ ] Naka-install ang **Node.js LTS** (`node --version` may output)  
2. [ ] Nakuha ang project (**Git clone** o **Download ZIP** + extract)  
3. [ ] `cd` papunta sa folder ng project  
4. [ ] `npm install` — walang error  
5. [ ] `npm run dev` — buksan ang `http://localhost:5173` sa browser  
6. [ ] Nasa `public/` ang `Automated_Paper_Binding_Machine.fbx`  

Kung may problema, itanong sa teacher o i-screenshot ang error message sa terminal para mas madaling matulungan.
