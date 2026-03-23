/* script_engine.js
 * სცენარის სკრიპტის ძრავა v0.2 გაზსადენებისთვის
 * -------------------------------------------------
 * საშუალებას იძლევა გაიწეროს მოქმედებების თანმიმდევრობა შემდეგი ფორმატით:
 * პირობა , მოქმედება
 * მაგალითები:
 * 14:20, n0.injection = 5
 * n1.pressure > 10, n1_n3.disable = true
 *
 * - მხარს უჭერს აბსოლუტურ დროს MM:SS ან HH:MM:SS ფორმატში
 * - მხარს უჭერს რიცხვით შედარებებს ნებისმიერი კვანძის/მილის მონაცემზე
 * - ასრულებს წესებს რიგითობით (FIFO). როდესაც წესის პირობა ჭეშმარიტი ხდება,
 * სრულდება მისი მოქმედება, ხაზი იღებება მწვანედ და ძრავა გადადის შემდეგ წესზე.
 * - ხაზები, რომელთა დამუშავებაც ვერ ხერხდება, იღებება წითლად.
 * - ექსპორტირებულია გლობალური ფუნქცია evaluateScripts(simulatedSeconds).
 * ------------------------------------------------- */
(function (global) {
  'use strict';

  const textareaId = 'scriptInput';
  const statusId   = 'scriptStatus';

  /** შიდა მდგომარეობა */
  let rules = [];

  /** დამხმარე ფუნქციები */
  function $(id) { return document.getElementById(id); }
  const textarea  = $(textareaId);
  const statusBox = $(statusId);

  if (!textarea) {
    console.warn('script_engine: ტექსტური არე #' + textareaId + ' ვერ მოიძებნა');
    return;
  }

  /** debounce დამხმარე ფუნქცია რედაქტირებისთვის */
  function debounce(fn, ms) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  /** სკრიპტის ხელახალი დამუშავება, როცა მომხმარებელი არედაქტირებს */
  textarea.addEventListener('input', debounce(loadScript, 300));
  loadScript(); // საწყისი ჩატვირთვა

  /** ------ სინტაქსური ანალიზი (Parsing) --------------------------------------- */
  function loadScript() {
    const lines = textarea.value.split(/\n+/).map(l => l.trim()).filter(Boolean);
    rules = lines.map(parseLine);
    renderStatuses();
  }

  function parseLine(line) {
    const rule = { raw: line, executed: false, error: false };
    try {
      const parts = line.split(',');
      if (parts.length !== 2) throw new Error('აკლია მძიმე');
      rule.condition = parseCondition(parts[0].trim());
      rule.action    = parseAction(parts[1].trim());
    } catch (e) {
      rule.error = true;
    }
    return rule;
  }

  function parseCondition(str) {
    /* დროის ფორმატი HH:MM[:SS] ან MM:SS */
    const t = str.match(/^(\d{1,4}):(\d{2}):(\d{2})$/);
    if (t) {
      const h = +t[1], m = +t[2], s = +t[3];
      return { type: 'time', value: h * 3600 + m * 60 + s };
    }

    /* შედარება: id.prop ოპერატორი მნიშვნელობა */
    const cmp = str.match(/^([\w\d_]+(?:_[\w\d_]+)?)\.(\w+)\s*(>=|<=|==|>|<)\s*([\d.]+)$/);
    if (cmp) {
      return {
        type: 'cmp',
        id: cmp[1],
        prop: cmp[2],
        op: cmp[3],
        value: parseFloat(cmp[4])
      };
    }
    throw new Error('პირობის სინტაქსი უცნობია');
  }

  function parseAction(str) {
    const a = str.match(/^([\w\d_]+(?:_[\w\d_]+)?)\.(\w+)\s*=\s*([\w\d.]+)$/);
    if (!a) throw new Error('მოქმედების სინტაქსი მცდარია');
    return { id: a[1], prop: a[2], value: toValue(a[3]) };
  }

  function toValue(v) {
    if (v === 'true')  return true;
    if (v === 'false') return false;
    const num = Number(v);
    return isNaN(num) ? v : num;
  }

  /** ------ შესრულება (Execution) ----------------------------------------------------- */
  function evaluateScripts(simSec) {
    if (!rules.length) return;
    const next = rules.find(r => !r.executed && !r.error);
    if (!next) return;

    try {
      if (conditionTrue(next.condition, simSec)) {
        performAction(next.action);
        next.executed = true;
        renderStatuses();
      }
    } catch (e) {
      next.error = true;
      renderStatuses();
    }
  }

  function conditionTrue(cond, simSec) {
    if (cond.type === 'time') return simSec >= cond.value;
    if (cond.type === 'cmp') {
      const el = getElement(cond.id);
      const val = dataOf(el, cond.prop);
      
      // კვანძის ინექციის შემოწმებისას, ვადარებთ მ³/საათში ერთეულებში
      if (cond.prop === 'injection' && el.isNode && el.isNode()) {
        return compare(val * 3600, cond.op, cond.value);
      }
      
      // ნაკადის მნიშვნელობის შემოწმება
      if (cond.prop === 'flow' && el.isEdge && el.isEdge()) {
        return compare(val * 3600, cond.op, cond.value);
      }
      
      return compare(val, cond.op, cond.value);
    }
    return false;
  }

  function performAction(act) {
    const el = getElement(act.id);
    
    // თუ კვანძის ინექციას ვაყენებთ, გადაგვყავს მ³/საათიდან მ³/წმ-ში
    if (act.prop === 'injection' && el.isNode && el.isNode()) {
      setData(el, act.prop, act.value / 3600);
    } else {
      setData(el, act.prop, act.value);
    }
  }

  /** ------ cytoscape-ის დამხმარე ფუნქციები -------------------------------------------- */
  function getElement(id) {
    if (typeof cy === 'undefined') throw new Error('cy არ არის განსაზღვრული');
    const els = cy.$('#' + id);
    if (!els.length) throw new Error('ელემენტი ' + id + ' ვერ მოიძებნა');
    return els;
  }
  function dataOf(el, prop) { return el.data(prop); }
  function setData(el, prop, v) {
    el.data(prop, v);
    if (typeof updateInfo === 'function') updateInfo();
  }


  function compare(a, op, b) {
    switch (op) {
      case '>':  return a >  b;
      case '<':  return a <  b;
      case '>=': return a >= b;
      case '<=': return a <= b;
      case '==': return a == b;
    }
  }

  /** ------ ინტერფეისი (UI) ------------------------------------------------------------ */
  function renderStatuses() {
    if (!statusBox) return;
    statusBox.innerHTML = '';
    rules.forEach(r => {
      const div = document.createElement('div');
      div.textContent = r.raw;
      if (r.error)         div.style.color = 'red';
      else if (r.executed) div.style.color = 'green';
      statusBox.appendChild(div);
    });
  }

  /** საჯარო ფუნქციების გამოქვეყნება */
  global.evaluateScripts = evaluateScripts;

  global.resetScriptEngine = function() {
    rules.forEach(r => {
      r.executed = false;
      r.error = false;
    });
    renderStatuses();
  };

  // --- LocalStorage-ში შენახვა -----------------------------------------
  const savedScript = localStorage.getItem('scriptText');
  if (savedScript) textarea.value = savedScript;

  textarea.addEventListener('input', debounce(() => {
    localStorage.setItem('scriptText', textarea.value);
    loadScript();
  }, 300));

  loadScript(); // საწყისი ჩატვირთვა
})(window);