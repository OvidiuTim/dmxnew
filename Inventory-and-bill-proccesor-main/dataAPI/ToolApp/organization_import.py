import hashlib
import json
import re
import unicodedata


class OrganizationSourceError(ValueError):
    pass


def _normalized_text(value):
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(character for character in text if not unicodedata.combining(character))
    text = text.casefold()
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def _name_variants(value):
    raw = str(value or "").split("//", 1)[0]
    raw = re.split(r"\s+-\s+", raw, maxsplit=1)[0]
    variants = {raw, re.sub(r"\([^)]*\)", " ", raw)}
    result = set()
    for variant in variants:
        normalized = _normalized_text(variant)
        tokens = [token for token in normalized.split() if not any(char.isdigit() for char in token)]
        if tokens:
            result.add(" ".join(tokens))
            result.add(" ".join(sorted(tokens)))
    return result


def match_employee(member_name, member_role, employees, claimed_ids=None):
    """Returnează numai o potrivire sigură; numele ambigue rămân neasociate."""
    claimed_ids = claimed_ids or set()
    wanted = _name_variants(member_name)
    candidates = [
        employee for employee in employees
        if employee.pk not in claimed_ids and wanted.intersection(_name_variants(employee.UserName))
    ]
    if len(candidates) == 1:
        return candidates[0]
    if not candidates:
        return None

    role_tokens = set(_normalized_text(member_role).split())
    scored = []
    for employee in candidates:
        trade_tokens = set(_normalized_text(employee.trade).split())
        scored.append((len(role_tokens.intersection(trade_tokens)), employee))
    scored.sort(key=lambda item: (-item[0], item[1].pk))
    if scored and scored[0][0] > 0 and (len(scored) == 1 or scored[0][0] > scored[1][0]):
        return scored[0][1]
    return None


def _source_key(kind, identity):
    digest = hashlib.sha1(identity.encode("utf-8")).hexdigest()
    return f"organigrama-html:{kind}:{digest}"


class _JavascriptExpressionParser:
    """Parser minimal pentru literalii și apelurile folosite de TREE din fișierul sursă."""

    def __init__(self, source, variables, functions):
        self.source = source
        self.variables = variables
        self.functions = functions
        self.position = 0

    def parse(self):
        value = self._value()
        self._skip()
        return value

    def _skip(self):
        while self.position < len(self.source):
            if self.source[self.position].isspace():
                self.position += 1
                continue
            if self.source.startswith("//", self.position):
                newline = self.source.find("\n", self.position)
                self.position = len(self.source) if newline < 0 else newline + 1
                continue
            if self.source.startswith("/*", self.position):
                end = self.source.find("*/", self.position + 2)
                if end < 0:
                    raise OrganizationSourceError("Comentariu JavaScript neterminat.")
                self.position = end + 2
                continue
            break

    def _value(self):
        self._skip()
        if self.position >= len(self.source):
            raise OrganizationSourceError("Expresie JavaScript incompletă.")
        char = self.source[self.position]
        if char in "'\"":
            return self._string()
        if char == "[":
            return self._array()
        if char == "{":
            return self._object()
        if char.isdigit() or char == "-":
            return self._number()
        identifier = self._identifier()
        if identifier == "true":
            return True
        if identifier == "false":
            return False
        if identifier in ("null", "undefined"):
            return None
        self._skip()
        if self._peek("("):
            return self._call(identifier)
        if identifier not in self.variables:
            raise OrganizationSourceError(f"Identificator JavaScript necunoscut: {identifier}")
        return self.variables[identifier]

    def _string(self):
        quote = self.source[self.position]
        self.position += 1
        output = []
        escapes = {"n": "\n", "r": "\r", "t": "\t", "b": "\b", "f": "\f", "v": "\v"}
        while self.position < len(self.source):
            char = self.source[self.position]
            self.position += 1
            if char == quote:
                return "".join(output)
            if char != "\\":
                output.append(char)
                continue
            if self.position >= len(self.source):
                break
            escaped = self.source[self.position]
            self.position += 1
            if escaped == "u":
                code = self.source[self.position:self.position + 4]
                if len(code) != 4:
                    raise OrganizationSourceError("Escape Unicode incomplet.")
                output.append(chr(int(code, 16)))
                self.position += 4
            else:
                output.append(escapes.get(escaped, escaped))
        raise OrganizationSourceError("Șir JavaScript neterminat.")

    def _array(self):
        self._expect("[")
        values = []
        while True:
            self._skip()
            if self._take("]"):
                return values
            values.append(self._value())
            self._skip()
            if self._take("]"):
                return values
            self._expect(",")

    def _object(self):
        self._expect("{")
        result = {}
        while True:
            self._skip()
            if self._take("}"):
                return result
            key = self._string() if self.source[self.position] in "'\"" else self._identifier()
            self._expect(":")
            result[key] = self._value()
            self._skip()
            if self._take("}"):
                return result
            self._expect(",")

    def _call(self, name):
        self._expect("(")
        args = []
        while True:
            self._skip()
            if self._take(")"):
                break
            args.append(self._value())
            self._skip()
            if self._take(")"):
                break
            self._expect(",")
        if name not in self.functions:
            raise OrganizationSourceError(f"Funcție JavaScript necunoscută: {name}")
        return self.functions[name](*args)

    def _number(self):
        match = re.match(r"-?\d+(?:\.\d+)?", self.source[self.position:])
        if not match:
            raise OrganizationSourceError("Număr JavaScript invalid.")
        raw = match.group(0)
        self.position += len(raw)
        return float(raw) if "." in raw else int(raw)

    def _identifier(self):
        self._skip()
        match = re.match(r"[A-Za-z_$][A-Za-z0-9_$]*", self.source[self.position:])
        if not match:
            excerpt = self.source[self.position:self.position + 30]
            raise OrganizationSourceError(f"Identificator așteptat lângă: {excerpt!r}")
        value = match.group(0)
        self.position += len(value)
        return value

    def _peek(self, token):
        self._skip()
        return self.source.startswith(token, self.position)

    def _take(self, token):
        if self._peek(token):
            self.position += len(token)
            return True
        return False

    def _expect(self, token):
        if not self._take(token):
            excerpt = self.source[self.position:self.position + 30]
            raise OrganizationSourceError(f"Se aștepta {token!r} lângă: {excerpt!r}")


def _json_constant(html, name):
    marker = f"const {name} ="
    start = html.find(marker)
    if start < 0:
        raise OrganizationSourceError(f"Constanta {name} nu există în fișier.")
    start = html.find("{", start + len(marker))
    try:
        return json.JSONDecoder().raw_decode(html[start:])[0]
    except (ValueError, TypeError) as exc:
        raise OrganizationSourceError(f"Constanta {name} nu conține JSON valid.") from exc


def _expression_after(html, marker):
    start = html.find(marker)
    if start < 0:
        raise OrganizationSourceError(f"Nu am găsit {marker!r}.")
    return html[start + len(marker):]


def parse_organization_html(html):
    data = _json_constant(html, "DATA")
    colors = {
        name: value for name, value in re.findall(
            r"\b(C_[A-Z0-9_]+)\s*=\s*['\"]([^'\"]+)['\"]", html
        )
    }
    teams_source = _expression_after(html, "const TEAMS =")
    teams = _JavascriptExpressionParser(teams_source, colors, {}).parse()

    def person(name, role="", photo=None, options=None):
        result = {"type": "person", "name": name, "role": role or "", "photo": photo}
        result.update(options or {})
        return result

    def department(name, color, members=None, children=None, subtitle=None):
        return {
            "type": "dept", "name": name, "color": color or "#2dd4a3",
            "members": members or [], "children": children or [], "sub": subtitle or "",
        }

    workers = data.get("workers") or []

    def team(team_code):
        definition = teams.get(team_code)
        if not definition:
            raise OrganizationSourceError(f"Echipă necunoscută în TREE: {team_code}")
        members = [worker.copy() for worker in workers if worker.get("team") == team_code]
        members.sort(key=lambda item: (
            -int(bool(item.get("foreman"))), -int(bool(item.get("conf"))),
            _normalized_text(item.get("name")),
        ))
        for member in members:
            member["type"] = "person"
        return department(
            definition.get("label") or team_code,
            definition.get("color"), members, [], definition.get("sub"),
        )

    variables = dict(colors)
    tree_source = _expression_after(html, "const TREE =")
    tree = _JavascriptExpressionParser(
        tree_source,
        variables,
        {"P": person, "dept": department, "team": team},
    ).parse()
    return {"data": data, "tree": tree}


def organization_records(parsed):
    data = parsed["data"]
    tree = parsed["tree"]
    photos = data.get("photos") or {}

    def member_record(member, department_identity, index):
        photo_key = member.get("photo")
        encoded_photo = photos.get(photo_key) if photo_key else None
        identity = f"{department_identity}/member/{member.get('name', '')}/{member.get('role', '')}/{index}"
        return {
            "source_key": _source_key("member", identity),
            "name": str(member.get("name") or "").strip(),
            "role": str(member.get("role") or "").strip(),
            "photo": f"data:image/jpeg;base64,{encoded_photo}" if encoded_photo else "",
            "sort_order": index,
            "metadata": {
                key: member.get(key) for key in ("foreman", "verif", "conf", "cim", "foreign", "team")
                if key in member
            },
        }

    def department_record(node, parent_identity, index):
        name = str(node.get("name") or "Departament").strip()
        identity = f"{parent_identity}/department/{name}/{index}"
        return {
            "source_key": _source_key("department", identity),
            "name": name,
            "subtitle": str(node.get("sub") or "").strip(),
            "color": str(node.get("color") or "#2dd4a3").strip(),
            "sort_order": index,
            "members": [
                member_record(member, identity, member_index)
                for member_index, member in enumerate(node.get("members") or [])
            ],
            "children": [
                department_record(child, identity, child_index)
                for child_index, child in enumerate(node.get("children") or [])
                if child.get("type") == "dept"
            ],
        }

    root_identity = "organization-root"
    return {
        "source_key": _source_key("department", root_identity),
        "name": "Conducere",
        "subtitle": "Novarion DMX Construction",
        "color": str(tree.get("color") or "#f5b301"),
        "sort_order": 0,
        "members": [
            member_record(member, root_identity, index)
            for index, member in enumerate(tree.get("persons") or [])
        ],
        "children": [
            department_record(child, root_identity, index)
            for index, child in enumerate(tree.get("children") or [])
            if child.get("type") == "dept"
        ],
    }


def count_records(root):
    departments = 1
    members = len(root.get("members") or [])
    photos = sum(1 for member in root.get("members") or [] if member.get("photo"))
    for child in root.get("children") or []:
        child_counts = count_records(child)
        departments += child_counts["departments"]
        members += child_counts["members"]
        photos += child_counts["photos"]
    return {"departments": departments, "members": members, "photos": photos}
