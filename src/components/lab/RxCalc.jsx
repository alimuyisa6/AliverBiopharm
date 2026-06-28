 import React, { useState, useEffect } from 'react';
import { fetchLabFormulas } from '../../api/client';

export default function RxCalc({ user }) {
  const [formulas, setFormulas] = useState([]);
  const [selectedFormula, setSelectedFormula] = useState(null);
  const [inputValues, setInputValues] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [level, setLevel] = useState('Pharmacy');
  const [drugSearch, setDrugSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchLabFormulas(level, drugSearch || null)
      .then(data => {
        if (!cancelled) {
          setFormulas(data || []);
          setSelectedFormula(null);
          setInputValues({});
          setResult(null);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setFormulas([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [level, drugSearch]);

  const handleFormulaSelect = (formula) => {
    setSelectedFormula(formula);
    const initialValues = {};
    (formula.variables || []).forEach(v => {
      initialValues[v.name] = '';
    });
    setInputValues(initialValues);
    setResult(null);
    setError(null);
  };

  const handleInputChange = (varName, value) => {
    setInputValues(prev => ({ ...prev, [varName]: value }));
    setResult(null);
    setError(null);
  };

  const handleCalculate = () => {
    if (!selectedFormula) return;

    const vars = selectedFormula.variables || [];
    const values = [];
    const names = [];

    for (const v of vars) {
      const val = parseFloat(inputValues[v.name]);
      if (isNaN(val)) {
        setError(`Please enter a valid number for ${v.label}`);
        return;
      }
      if (v.min !== undefined && val < v.min) {
        setError(`${v.label} must be at least ${v.min} ${v.unit}`);
        return;
      }
      if (v.max !== undefined && val > v.max) {
        setError(`${v.label} must not exceed ${v.max} ${v.unit}`);
        return;
      }
      values.push(val);
      names.push(v.name);
    }

    try {
      const safeFormula = selectedFormula.formula.replace(/[^0-9+\-*/().%\s\w_]/g, '');
      const computed = new Function(...names, `return ${safeFormula}`)(...values);

      if (isNaN(computed) || !isFinite(computed)) {
        setError('Calculation resulted in an invalid value');
        return;
      }

      const rounded = Math.round(computed * 100) / 100;
      const normalRange = selectedFormula.normal_ranges?.result;
      let status = 'normal';

      if (normalRange) {
        if (rounded < normalRange.min) status = 'low';
        else if (rounded > normalRange.max) status = 'high';
      }

      setResult({
        value: rounded,
        unit: normalRange?.unit || '',
        normalRange,
        status
      });
      setError(null);
    } catch (e) {
      setError('Calculation error. Please check your inputs.');
    }
  };

  return (
    <div className="learning-lab">
      <div className="lab-tool-container">
        <div className="lab-tool-header">
          <h2 className="lab-tool-heading">
            <i className="fa-solid fa-flask-vial"></i> RxCalc
          </h2>
          <p className="lab-tool-description">
            Master dosing with formula-driven calculations.
          </p>
        </div>

        <div className="lab-level-filter">
          <label className="lab-level-label">Level:</label>
          <select
            className="lab-level-select"
            value={level}
            onChange={e => setLevel(e.target.value)}
          >
            <option value="O-Level">O-Level</option>
            <option value="A-Level">A-Level</option>
            <option value="pharmacy">Pharmacy</option>
          </select>
          <input
            type="text"
            className="lab-search-input"
            placeholder="Search formulas..."
            value={drugSearch}
            onChange={e => setDrugSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="lab-loading">Loading formulas...</div>
        ) : !selectedFormula ? (
          <div className="lab-formula-list">
            {formulas.map(f => (
              <button
                key={f.id}
                className="lab-formula-card"
                onClick={() => handleFormulaSelect(f)}
              >
                <h3 className="lab-formula-card-title">{f.drug_name}</h3>
                <p className="lab-formula-card-indication">{f.indication}</p>
                <span className="lab-formula-card-badge">{f.level}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="lab-calc-viewer">
            <button
              className="lab-back-btn lab-pathway-back"
              onClick={() => {
                setSelectedFormula(null);
                setResult(null);
                setError(null);
              }}
            >
              <i className="fa-solid fa-arrow-left"></i> All Formulas
            </button>

            <h3 className="lab-calc-title">{selectedFormula.drug_name}</h3>
            <p className="lab-calc-indication">{selectedFormula.indication}</p>

            <div className="lab-calc-inputs">
              {(selectedFormula.variables || []).map(v => (
                <div key={v.name} className="lab-calc-input-group">
                  <label className="lab-calc-label">
                    {v.label} {v.unit ? `(${v.unit})` : ''}
                  </label>
                  <input
                    type="number"
                    className="lab-calc-input"
                    value={inputValues[v.name] || ''}
                    onChange={e => handleInputChange(v.name, e.target.value)}
                    placeholder={`${v.min || 0} - ${v.max || '...'}`}
                    min={v.min}
                    max={v.max}
                    step="any"
                  />
                </div>
              ))}
            </div>

            <button className="lab-calc-btn" onClick={handleCalculate}>
              <i className="fa-solid fa-calculator"></i> Calculate
            </button>

            {error && (
              <div className="lab-calc-error">
                <i className="fa-solid fa-triangle-exclamation"></i> {error}
              </div>
            )}

            {result && (
              <div className={`lab-calc-result ${result.status !== 'normal' ? 'lab-calc-result-warning' : ''}`}>
                <div className="lab-calc-result-value">
                  {result.value} {result.unit}
                </div>
                {result.normalRange && (
                  <div className="lab-calc-result-range">
                    Normal range: {result.normalRange.min} - {result.normalRange.max} {result.normalRange.unit}
                  </div>
                )}
                {result.status === 'low' && (
                  <div className="lab-calc-result-alert lab-calc-result-low">
                    <i className="fa-solid fa-arrow-down"></i> Value is below normal range
                  </div>
                )}
                {result.status === 'high' && (
                  <div className="lab-calc-result-alert lab-calc-result-high">
                    <i className="fa-solid fa-arrow-up"></i> Value is above normal range
                  </div>
                )}
                {result.status === 'normal' && (
                  <div className="lab-calc-result-alert lab-calc-result-ok">
                    <i className="fa-solid fa-circle-check"></i> Value is within normal range
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
