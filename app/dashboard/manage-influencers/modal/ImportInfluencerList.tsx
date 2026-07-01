"use client"

export default function ImportInfluencerList({ close }: any) {

  return (

    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">

      <div className="bg-white w-[900px] max-w-[95vw] rounded-2xl shadow-xl p-8">

        {/* HEADER */}
        <div className="flex items-center justify-between mb-4">

          <h2 className="text-lg font-semibold text-[#1E1E1E]">
            Import List
          </h2>

          <button
            onClick={close}
            className="text-gray-500 text-xl hover:text-[#0F6B3E]"
          >
            ×
          </button>

        </div>

        {/* GUIDE TEXT */}
        <p className="text-sm text-gray-500 mb-6">
          Import Guide : To import your list into instroom, first download the Sample CSV to check the required format,
          then fill in your data and save it as a CSV (.csv) file. Next, click "Click to upload a file" to upload
          your CSV, ensure the data is mapped correctly, and confirm the import.
        </p>

        {/* SAMPLE BUTTONS */}
        <div className="grid grid-cols-2 gap-4 mb-6">

          <button className="h-11 border border-gray-200 rounded-lg bg-gray-50 text-sm hover:border-[#1FAE5B] hover:text-[#0F6B3E] transition">
            Make a copy of sample csv
          </button>

          <button className="h-11 border border-gray-200 rounded-lg bg-gray-50 text-sm hover:border-[#1FAE5B] hover:text-[#0F6B3E] transition">
            Sample csv
          </button>

        </div>

        {/* DRAG DROP AREA */}
        <div className="border-2 border-dashed border-[#1FAE5B]/60 rounded-lg h-[180px] flex items-center justify-center mb-6 bg-[#1FAE5B]/5">

          <p className="text-sm text-[#0F6B3E]">
            Drag and drop your CSV file here or browse file. Import is limited to 5 MB
          </p>

        </div>

        {/* ACTION BUTTONS */}
        <div className="flex items-center justify-end gap-4 pt-4">

          <button
            onClick={close}
            className="px-6 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>

          <button className="px-6 py-2 bg-[#1FAE5B] text-white rounded-lg text-sm hover:bg-[#0F6B3E] transition">
            Import
          </button>

        </div>

      </div>

    </div>
  )
}